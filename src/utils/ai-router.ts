import { env, pipeline } from "@xenova/transformers"

import { sampleText } from "./extract"
import { matchesAnyKeyword } from "./keywords"
import type { ExtensionSettings } from "./storage"

// ─────────────────────────────────────────────────────────────────────────────
// Configure Transformers.js for an MV3 service worker:
//   - WASM binaries and the toxicity model are bundled locally. The optional
//     bias model is fetched once from Hugging Face and cached by the browser.
//     Text never leaves the device either way.
//   - Single-threaded: MV3 workers do not have SharedArrayBuffer.
//   - No worker proxy: nesting workers inside a service worker is unsupported.
// ─────────────────────────────────────────────────────────────────────────────
env.allowLocalModels = true
if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
  env.localModelPath = chrome.runtime.getURL("models/")
}
if (env.backends.onnx?.wasm) {
  env.backends.onnx.wasm.numThreads = 1
  env.backends.onnx.wasm.proxy = false
  if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
    env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL("wasm/")
  }
} else {
  console.error(
    "[Neoblocker] ONNX backend unavailable",
    Object.keys(env.backends),
    env.backends
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Model status broadcasting — lets the popup show download progress/errors.
// ─────────────────────────────────────────────────────────────────────────────
export type ModelStatus = "idle" | "loading" | "loaded" | "error"

export interface ModelStatuses {
  toxicity: ModelStatus
  bias: ModelStatus
  /** Download progress 0..1, or 0 when nothing has been reported yet. */
  progress: {
    toxicity: number
    bias: number
  }
}

const modelStatuses: ModelStatuses = {
  toxicity: "idle",
  bias: "idle",
  progress: { toxicity: 0, bias: 0 }
}

let lastBroadcast = 0

function broadcastStatus(force = false) {
  if (
    typeof chrome === "undefined" ||
    !chrome.runtime?.sendMessage ||
    (!force && Date.now() - lastBroadcast < 450)
  ) {
    return
  }
  lastBroadcast = Date.now()
  chrome.runtime
    .sendMessage({ action: "modelStatus", statuses: getModelStatuses() })
    .catch(() => {
      // The popup is usually closed — this is a best-effort notification.
    })
}

export function getModelStatuses(): ModelStatuses {
  return {
    toxicity: modelStatuses.toxicity,
    bias: modelStatuses.bias,
    progress: { ...modelStatuses.progress }
  }
}

function setStatus(model: "toxicity" | "bias", status: ModelStatus) {
  modelStatuses[model] = status
  if (status !== "loading") modelStatuses.progress[model] = 0
  broadcastStatus(true)
}

function setProgress(model: "toxicity" | "bias", value: number) {
  const progress = Math.min(1, Math.max(0, value))
  modelStatuses.progress[model] = progress
  broadcastStatus()
}

const progressCallback =
  (model: "toxicity" | "bias") =>
  (event: { status?: string; progress?: number }) => {
    if (event?.status === "progress" && typeof event.progress === "number") {
      setProgress(model, event.progress / 100)
    }
  }

// ─────────────────────────────────────────────────────────────────────────────
// Inference is serialised. ONNX runs single-threaded in a service worker, so
// feeding it parallel classifier calls only spikes memory and delays the queue.
// ─────────────────────────────────────────────────────────────────────────────
class SerialQueue {
  private tail: Promise<unknown> = Promise.resolve()

  run<T>(task: () => Promise<T>): Promise<T> {
    const result = this.tail.then(task, task)
    this.tail = result.catch(() => undefined)
    return result
  }
}

const inferenceQueue = new SerialQueue()

function lruGet<K, V>(map: Map<K, V>, key: K): V | undefined {
  if (!map.has(key)) return undefined
  const value = map.get(key) as V
  map.delete(key)
  map.set(key, value)
  return value
}

function lruSet<K, V>(map: Map<K, V>, key: K, value: V, max: number) {
  if (map.size >= max) {
    const oldest = map.keys().next().value
    if (oldest !== undefined) map.delete(oldest)
  }
  map.set(key, value)
}

// ─────────────────────────────────────────────────────────────────────────────
// Tier 1: Toxicity Classifier
//   Model: minuva/MiniLMv2-toxic-jigsaw-onnx (22.9 MB quantized)
//   Labels: toxic, severe_toxic, obscene, threat, insult, identity_hate
//   Distilled MiniLM — roughly 100 MB smaller than the previous RoBERTa
//   model and much faster to download and run.
// ─────────────────────────────────────────────────────────────────────────────
const TOXICITY_MODEL = "minilm"
const HATE_KEYWORDS = [
  "kkk",
  "white supremacist",
  "grand wizard",
  "neo-nazi",
  "racist",
  "racism"
]
const HATE_REGEX = new RegExp(
  `(${HATE_KEYWORDS.map((word) =>
    word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  ).join("|")})`,
  "i"
)
const EXPLICIT_REGEX =
  /\b(porn|pornography|nsfw|xxx|onlyfans|nudes?|explicit sex|sexual content)\b/i

class ToxicityClassifier {
  private static cache = new Map<string, Promise<Record<string, number>>>()
  private static initializationPromise: Promise<any> | null = null

  static getInstance(): Promise<any> {
    if (this.initializationPromise) return this.initializationPromise

    console.log("[Neoblocker] Loading toxicity model (WASM)…")
    setStatus("toxicity", "loading")

    this.initializationPromise = pipeline(
      "text-classification",
      TOXICITY_MODEL,
      {
        progress_callback: progressCallback("toxicity")
      }
    )
      .then((pipe) => {
        console.log("[Neoblocker] Toxicity model ready.")
        setStatus("toxicity", "loaded")
        return pipe as any
      })
      .catch((error) => {
        console.error("[Neoblocker] Toxicity model failed to load:", error)
        setStatus("toxicity", "error")
        this.initializationPromise = null
        throw error
      })

    return this.initializationPromise
  }

  static unload() {
    this.initializationPromise = null
    this.cache.clear()
    setStatus("toxicity", "idle")
  }

  static analyze(text: string): Promise<Record<string, number>> {
    const cached = lruGet(this.cache, text)
    if (cached) return cached

    const analysis = (async () => {
      try {
        // Start the (possibly multi-minute) model download before entering the
        // inference queue, so toxicity and bias can download in parallel.
        const classifier = await this.getInstance()
        return await inferenceQueue.run(async () => {
          const results = (await classifier(sampleText(text, 1200), {
            topk: 16
          })) as Array<{ label: string; score: number }>
          const scores: Record<string, number> = {}
          for (const result of results) scores[result.label] = result.score
          return scores
        })
      } catch (error) {
        this.cache.delete(text)
        throw error
      }
    })()

    lruSet(this.cache, text, analysis, 400)
    return analysis
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tier 2: Bias & clickbait classifier
//   Model: protectai/distilroberta-bias-onnx
//   Labels: BIASED / NEUTRAL
// ─────────────────────────────────────────────────────────────────────────────
const BIAS_MODEL = "protectai/distilroberta-bias-onnx"

class BiasClassifier {
  private static cache = new Map<string, Promise<number>>()
  private static initializationPromise: Promise<any> | null = null

  static getInstance(): Promise<any> {
    if (this.initializationPromise) return this.initializationPromise

    console.log("[Neoblocker] Loading bias model (WASM)…")
    setStatus("bias", "loading")

    this.initializationPromise = pipeline("text-classification", BIAS_MODEL, {
      model_file_name: "../model",
      progress_callback: progressCallback("bias")
    })
      .then((pipe) => {
        console.log("[Neoblocker] Bias model ready.")
        setStatus("bias", "loaded")
        return pipe as any
      })
      .catch((error) => {
        console.error("[Neoblocker] Bias model failed to load:", error)
        setStatus("bias", "error")
        this.initializationPromise = null
        throw error
      })

    return this.initializationPromise
  }

  static unload() {
    this.initializationPromise = null
    this.cache.clear()
    setStatus("bias", "idle")
  }

  static analyze(text: string): Promise<number> {
    const cached = lruGet(this.cache, text)
    if (cached) return cached

    const analysis = (async () => {
      try {
        // See ToxicityClassifier.analyze: downloads must not hold the queue.
        const classifier = await this.getInstance()
        return await inferenceQueue.run(async () => {
          const results = (await classifier(sampleText(text, 1200))) as Array<{
            label: string
            score: number
          }>
          const result = results[0]
          return result && result.label === "BIASED" ? result.score : 0
        })
      } catch (error) {
        this.cache.delete(text)
        throw error
      }
    })()

    lruSet(this.cache, text, analysis, 400)
    return analysis
  }
}

/** Free models that the user has switched off and keep enabled ones warm. */
export function applyModelSettings(settings: ExtensionSettings) {
  if (!settings.enableToxicity && modelStatuses.toxicity !== "idle") {
    ToxicityClassifier.unload()
  }
  if (!settings.enableBias && modelStatuses.bias !== "idle") {
    BiasClassifier.unload()
  }
}

/** Load the models ahead of the first page scan (popup open / retry). */
export async function warmupModels(
  settings: ExtensionSettings
): Promise<ModelStatuses> {
  const tasks: Promise<unknown>[] = []
  if (settings.enableToxicity) {
    tasks.push(ToxicityClassifier.getInstance().catch(() => undefined))
  }
  if (settings.enableBias) {
    tasks.push(BiasClassifier.getInstance().catch(() => undefined))
  }
  await Promise.all(tasks)
  broadcastStatus(true)
  return getModelStatuses()
}

// ─────────────────────────────────────────────────────────────────────────────
// Detection logic
// ─────────────────────────────────────────────────────────────────────────────
const SAFE_CONTEXT_KEYWORDS = [
  // Gaming
  "gameplay",
  "walkthrough",
  "speedrun",
  "boss",
  "let's play",
  "fps",
  "multiplayer",
  "match",
  "tournament",
  "lore",
  "playthrough",
  // Education & history
  "history",
  "documentary",
  "science",
  "tutorial",
  "how to",
  "guide",
  "explained",
  "course",
  "lesson",
  "theory",
  "essay",
  // Entertainment
  "review",
  "unboxing",
  "reaction",
  "tier list",
  "challenge"
]

const SAFE_CONTEXT_REGEX = new RegExp(
  `\\b(${SAFE_CONTEXT_KEYWORDS.map((keyword) =>
    keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  ).join("|")})\\b`,
  "i"
)

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

function clampThreshold(value: unknown, fallback: number): number {
  const number = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(0.95, Math.max(0.05, number))
}

export interface AnalysisResult {
  action: "LOCAL_BLOCK" | "SAFE"
  reason?: string
  /** Set when a model could not run; callers must not cache this result. */
  error?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Main entry point: analyzeContent
// ─────────────────────────────────────────────────────────────────────────────
export async function analyzeContent(
  text: string,
  settings: ExtensionSettings,
  isTitle = false
): Promise<AnalysisResult> {
  try {
    if (!settings.enabled) return { action: "SAFE" }

    const cleanText = normalizeText(text)
    if (cleanText.length < 12) return { action: "SAFE" }

    if (matchesAnyKeyword(settings.exceptions, cleanText)) {
      return { action: "SAFE" }
    }

    const isSafeContext = SAFE_CONTEXT_REGEX.test(cleanText)
    let modelError = false

    let toxScores: Record<string, number> = {}
    if (settings.enableToxicity) {
      try {
        toxScores = await ToxicityClassifier.analyze(cleanText)
      } catch (error) {
        console.error("[Neoblocker] Toxicity analysis failed:", error)
        modelError = true
      }
    }

    const toxicity = toxScores["toxicity"] ?? toxScores["toxic"] ?? 0
    const severeToxicity =
      toxScores["severe_toxicity"] ?? toxScores["severe_toxic"] ?? 0
    const obscene = toxScores["obscene"] || 0
    const threat = toxScores["threat"] || 0
    const insult = toxScores["insult"] || 0
    let identityAttack =
      toxScores["identity_attack"] ?? toxScores["identity_hate"] ?? 0
    const sexualExplicit =
      toxScores["sexual_explicit"] ??
      (!isSafeContext && EXPLICIT_REGEX.test(cleanText)
        ? Math.max(obscene, 0.9)
        : 0)

    // Explicit hate/extremist terms are a strong signal that the unbiased
    // model sometimes under-scores. Elevate identity_attack for those.
    if (settings.enableToxicity && HATE_REGEX.test(cleanText)) {
      identityAttack = Math.max(identityAttack, 0.85)
    }

    // The bias model is an optional second download. Only start it when the
    // toxicity model has produced a meaningful signal, so safe pages never
    // pay the 83 MB cost.
    let biasScore = 0
    if (
      settings.enableBias &&
      !isSafeContext &&
      toxicity >= 0.4
    ) {
      try {
        biasScore = await BiasClassifier.analyze(cleanText)
      } catch (error) {
        console.error("[Neoblocker] Bias analysis failed:", error)
        modelError = true
      }
    }

    const toxicityLimit = clampThreshold(settings.toxicityThreshold, 0.5)
    const racismLimit = clampThreshold(settings.racismThreshold, 0.15)
    const biasLimit = clampThreshold(settings.biasThreshold, 0.5)
    const toxicityScore =
      toxicity * 0.4 + insult * 0.3 + severeToxicity * 0.3

    // ── Pass one: fast title scan ────────────────────────────────────────────
    if (isTitle) {
      if (settings.enableToxicity) {
        if (sexualExplicit >= 0.85) {
          return { action: "LOCAL_BLOCK", reason: "Explicit Content (Title)" }
        }
        if (threat >= 0.8) {
          return { action: "LOCAL_BLOCK", reason: "Threats & Violence (Title)" }
        }

        const identityAttackLimit = Math.min(racismLimit, 0.45)
        const titleToxicityLimit = Math.min(toxicityLimit, 0.35)
        if (
          identityAttack >= identityAttackLimit &&
          toxicity >= titleToxicityLimit
        ) {
          return {
            action: "LOCAL_BLOCK",
            reason: "Hate Speech & Discrimination (Title)"
          }
        }

        const severeLimit = Math.min(toxicityLimit * 0.8, 0.4)
        const insultLimit = Math.min(toxicityLimit * 0.8, 0.4)
        if (severeToxicity >= severeLimit && insult >= insultLimit) {
          return {
            action: "LOCAL_BLOCK",
            reason: "Hostile / Harassing Content (Title)"
          }
        }

        if (
          toxicityScore >=
          Math.min(toxicityLimit + 0.15, 0.8)
        ) {
          return {
            action: "LOCAL_BLOCK",
            reason: "Toxic / Hostile Content (Title)"
          }
        }
      }

      if (biasScore >= biasLimit) {
        return {
          action: "LOCAL_BLOCK",
          reason: "Rage-Bait / Clickbait Content (Title)"
        }
      }

      return modelError
        ? { action: "SAFE", error: "Model unavailable" }
        : { action: "SAFE" }
    }

    // ── Pass two: deep scan (subtitles and comments) ─────────────────────────
    if (settings.enableToxicity) {
      if (threat >= 0.35) {
        return { action: "LOCAL_BLOCK", reason: "Threats & Violence" }
      }
      if (sexualExplicit >= 0.75) {
        return { action: "LOCAL_BLOCK", reason: "Explicit Content" }
      }

      // A mild identity score without hostile signals is often a
      // documentary/educational sentence, so let it through. Strong overall
      // toxicity is enough to treat a mid-range identity score as hostile;
      // this catches statements like "those people are ruining everything"
      // that the compact model scores below its explicit-hate range.
      let blockIdentity = false
      if (!isSafeContext && identityAttack >= racismLimit) {
        if (
          identityAttack > 0.5 ||
          toxicity >= Math.max(0.5, toxicityLimit) ||
          severeToxicity >= 0.1 ||
          insult >= 0.2
        ) {
          blockIdentity = true
        }
      }
      if (blockIdentity) {
        return { action: "LOCAL_BLOCK", reason: "Hate Speech & Discrimination" }
      }

      if (
        settings.enableObscene &&
        obscene >= 0.75 &&
        insult >= 0.65 &&
        severeToxicity >= 0.2
      ) {
        return { action: "LOCAL_BLOCK", reason: "Abusive Harassment" }
      }

      if (toxicityScore >= toxicityLimit) {
        return { action: "LOCAL_BLOCK", reason: "Toxic / Hostile Content" }
      }
    }

    if (settings.enableBias && !isSafeContext) {
      if (biasScore >= biasLimit && toxicity >= 0.4) {
        return {
          action: "LOCAL_BLOCK",
          reason: "Rage-Bait / Clickbait Content"
        }
      }
    }

    return modelError
      ? { action: "SAFE", error: "Model unavailable" }
      : { action: "SAFE" }
  } catch (error) {
    console.error("[Neoblocker] Analysis pipeline failed:", error)
    return { action: "SAFE", error: "Analysis failed" }
  }
}
