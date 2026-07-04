import { pipeline } from "@xenova/transformers"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { analyzeContent, NanoClassifier } from "./ai-router"

vi.mock("@xenova/transformers", () => {
  const mockPipeline = vi.fn().mockImplementation((task, model) => {
    const classifier = vi.fn().mockImplementation((text, options) => {
      if (model.includes("bias")) {
        return Promise.resolve([{ label: "BIASED", score: 0.9 }])
      } else {
        return Promise.resolve([
          { label: "toxicity", score: 0.1 },
          { label: "severe_toxicity", score: 0.05 },
          { label: "obscene", score: 0.05 },
          { label: "threat", score: 0.05 },
          { label: "insult", score: 0.05 },
          { label: "identity_attack", score: 0.05 },
          { label: "sexual_explicit", score: 0.05 }
        ])
      }
    })
    return Promise.resolve(classifier)
  })

  return {
    pipeline: mockPipeline,
    env: {
      allowLocalModels: false,
      backends: {
        onnx: {
          wasm: {
            numThreads: 1,
            proxy: false,
            wasmPaths: ""
          }
        }
      }
    }
  }
})

describe("NanoClassifier", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  it("should analyze text successfully", async () => {
    const mockSession = {
      prompt: vi.fn().mockResolvedValue("  block  ")
    }
    vi.spyOn(NanoClassifier, "getSession").mockResolvedValue(mockSession as any)

    const result = await NanoClassifier.analyze("some bad text")
    expect(result).toBe("BLOCK")
    expect(NanoClassifier.getSession).toHaveBeenCalled()
    expect(mockSession.prompt).toHaveBeenCalledWith("some bad text")
  })

  it("should return SAFE when getSession throws an error", async () => {
    const error = new Error("Failed to create session")
    vi.spyOn(NanoClassifier, "getSession").mockRejectedValue(error)

    const result = await NanoClassifier.analyze("some text")
    expect(result).toBe("SAFE")
    expect(console.error).toHaveBeenCalledWith("NanoClassifier error:", error)
  })

  it("should return SAFE when session.prompt throws an error", async () => {
    const error = new Error("Prompt failed")
    const mockSession = {
      prompt: vi.fn().mockRejectedValue(error)
    }
    vi.spyOn(NanoClassifier, "getSession").mockResolvedValue(mockSession as any)

    const result = await NanoClassifier.analyze("some text")
    expect(result).toBe("SAFE")
    expect(console.error).toHaveBeenCalledWith("NanoClassifier error:", error)
  })
})

describe("analyzeContent safe-context check", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should skip bias analysis when a safe context keyword is present as a whole word", async () => {
    const settings = {
      exceptions: "",
      enableToxicity: true,
      enableBias: true,
      enableObscene: true,
      toxicityThreshold: 0.5,
      racismThreshold: 0.5,
      biasThreshold: 0.5,
      theme: "dark" as "dark",
      filterMode: "blur" as "blur",
      bannedKeywords: ""
    }

    // "tutorial" is a safe keyword.
    // If it works, the bias classifier should not be invoked.
    const result = await analyzeContent(
      "This is a video tutorial on coding",
      settings,
      false
    )
    expect(result.action).toBe("SAFE")

    const toxicityModelCalled = (pipeline as any).mock.calls.some(
      (call: any) => call[1] === "protectai/unbiased-toxic-roberta-onnx"
    )
    const biasModelCalled = (pipeline as any).mock.calls.some(
      (call: any) => call[1] === "protectai/distilroberta-bias-onnx"
    )

    expect(toxicityModelCalled).toBe(true)
    expect(biasModelCalled).toBe(false)
  })

  it("should NOT skip bias analysis when a safe context keyword is part of a larger word (e.g. mismatch)", async () => {
    const settings = {
      exceptions: "",
      enableToxicity: true,
      enableBias: true,
      enableObscene: true,
      toxicityThreshold: 0.5,
      racismThreshold: 0.5,
      biasThreshold: 0.5,
      theme: "dark" as "dark",
      filterMode: "blur" as "blur",
      bannedKeywords: ""
    }

    // "mismatch" contains "match" (a safe keyword), but "mismatch" itself is not safe.
    // So the bias classifier SHOULD be invoked.
    await analyzeContent("There is a mismatch in the results", settings, false)

    const biasModelCalled = (pipeline as any).mock.calls.some(
      (call: any) => call[1] === "protectai/distilroberta-bias-onnx"
    )
    expect(biasModelCalled).toBe(true)
  })
})
