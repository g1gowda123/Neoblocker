import { beforeEach, describe, expect, it, vi } from "vitest"

import { analyzeContent, applyModelSettings } from "./ai-router"
import { DEFAULT_SETTINGS } from "./storage"
import type { ExtensionSettings } from "./storage"

const modelState = vi.hoisted(() => ({
  scores: {
    toxic: 0.1,
    severe_toxic: 0.05,
    obscene: 0.05,
    threat: 0.05,
    insult: 0.05,
    identity_hate: 0.05
  } as Record<string, number>,
  bias: 0.9,
  throwError: false,
  calls: [] as string[]
}))

vi.mock("@xenova/transformers", () => {
  const pipeline = vi.fn(async (_task: string, model: string) => {
    modelState.calls.push(model)
    if (modelState.throwError) throw new Error("model load failed")

    return async (_text: string) => {
      if (model.includes("protectai/distilroberta-bias-onnx")) {
        return [{ label: "BIASED", score: modelState.bias }]
      }
      return Object.entries(modelState.scores).map(([label, score]) => ({
        label,
        score
      }))
    }
  })

  return {
    pipeline,
    env: {
      allowLocalModels: false,
      backends: {
        onnx: {
          wasm: { numThreads: 1, proxy: false, wasmPaths: "" }
        }
      }
    }
  }
})

const settings = (overrides: Partial<ExtensionSettings> = {}) => ({
  ...DEFAULT_SETTINGS,
  ...overrides
})

function unloadModels() {
  applyModelSettings(settings({ enableToxicity: false, enableBias: false }))
}

describe("analyzeContent", () => {
  beforeEach(() => {
    modelState.throwError = false
    modelState.bias = 0.9
    modelState.calls = []
    modelState.scores = {
      toxic: 0.1,
      severe_toxic: 0.05,
      obscene: 0.05,
      threat: 0.05,
      insult: 0.05,
      identity_hate: 0.05
    }
    unloadModels()
    vi.spyOn(console, "error").mockImplementation(() => {})
    vi.spyOn(console, "warn").mockImplementation(() => {})
  })

  it("does no work when the master switch is off", async () => {
    const result = await analyzeContent(
      "This is a horribly toxic threat with explicit content",
      settings({ enabled: false })
    )

    expect(result).toEqual({ action: "SAFE" })
    expect(modelState.calls).toHaveLength(0)
  })

  it("skips bias analysis when a safe-context keyword is a whole word", async () => {
    modelState.scores.toxic = 0.7

    const result = await analyzeContent(
      "This is a video tutorial on coding",
      settings({ enableBias: true }),
      false
    )

    expect(result.action).toBe("SAFE")
    expect(modelState.calls).toContain("minilm")
    expect(modelState.calls).not.toContain(
      "protectai/distilroberta-bias-onnx"
    )
  })

  it("still runs bias analysis when a safe keyword is only part of a word", async () => {
    modelState.bias = 0.95
    modelState.scores.toxic = 0.7

    await analyzeContent(
      "There is a mismatch in the results",
      settings({ enableBias: true }),
      false
    )

    expect(modelState.calls).toContain(
      "protectai/distilroberta-bias-onnx"
    )
  })

  it("does not download the bias model unless it is enabled and toxicity fires", async () => {
    modelState.scores.toxic = 0.7

    await analyzeContent(
      "This sentence is clearly toxic enough to trigger the classifier",
      settings(),
      false
    )

    expect(modelState.calls).toEqual(["minilm"])
  })

  it("blocks a threatening title in the fast title pass", async () => {
    modelState.scores.threat = 0.91

    const result = await analyzeContent(
      "I will find you and hurt you tonight",
      settings(),
      true
    )

    expect(result.action).toBe("LOCAL_BLOCK")
    expect(result.reason).toContain("Threats")
  })

  it("blocks strongly toxic deep-scan text using the weighted score", async () => {
    modelState.scores.toxic = 0.8
    modelState.scores.insult = 0.5
    modelState.scores.severe_toxic = 0.3

    const result = await analyzeContent(
      "You are a worthless piece of trash and everyone hates you",
      settings(),
      false
    )

    expect(result.action).toBe("LOCAL_BLOCK")
    expect(result.reason).toContain("Toxic")
  })

  it("blocks identity hate when the compact model scores toxicity and identity_hate", async () => {
    modelState.scores.toxic = 0.64
    modelState.scores.identity_hate = 0.171
    modelState.scores.insult = 0.04

    const result = await analyzeContent(
      "I hate those immigrants, they are ruining everything",
      settings(),
      false
    )

    expect(result.action).toBe("LOCAL_BLOCK")
    expect(result.reason).toContain("Hate Speech")
  })

  it("does not block explicit wording on its own", async () => {
    const result = await analyzeContent(
      "Porn stars reveal their secrets",
      settings(),
      true
    )

    expect(result.action).toBe("SAFE")
  })

  it("returns an error instead of SAFE when a model cannot load", async () => {
    modelState.throwError = true

    const result = await analyzeContent(
      "A sentence long enough to reach the classifier safely",
      settings(),
      true
    )

    expect(result.action).toBe("SAFE")
    expect(result.error).toBe("Model unavailable")
  })

  it("respects the exception list before running models", async () => {
    const result = await analyzeContent(
      "This is a video tutorial on coding",
      settings({ exceptions: "coding" })
    )

    expect(result.action).toBe("SAFE")
    expect(modelState.calls).toHaveLength(0)
  })
})
