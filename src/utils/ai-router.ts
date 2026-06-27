import { env, pipeline } from "@xenova/transformers"

import type { ExtensionSettings } from "./storage"

// ─────────────────────────────────────────────────────────────────────────────
// Configure Transformers.js for MV3 Service Worker:
//   - Disable remote model fetching for WASM binaries (use locally bundled files)
//   - Single-threaded: MV3 service workers do not support SharedArrayBuffer
//   - Proxy disabled: no Worker nesting in service workers
// ─────────────────────────────────────────────────────────────────────────────
env.allowLocalModels = false
env.backends.onnx.wasm.numThreads = 1
env.backends.onnx.wasm.proxy = false
if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getURL) {
  env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL("wasm/")
}

// ─────────────────────────────────────────────────────────────────────────────
// Model status broadcasting — lets the popup know if models are loading
// ─────────────────────────────────────────────────────────────────────────────
export type ModelStatus = "idle" | "loading" | "loaded" | "error"

export interface ModelStatuses {
  toxicity: ModelStatus
  bias: ModelStatus
}

let modelStatuses: ModelStatuses = {
  toxicity: "idle",
  bias: "idle"
}

function broadcastStatus() {
  chrome.runtime
    .sendMessage({ action: "modelStatus", statuses: modelStatuses })
    .catch(() => {
      // Popup may not be open — silently ignore
    })
}

// ─────────────────────────────────────────────────────────────────────────────
// Tier 1: Toxicity Classifier
//   Model: protectai/unbiased-toxic-roberta-onnx
//   Labels: toxic, severe_toxic, obscene, threat, insult, identity_hate
//   This model is trained to mitigate unintended bias (Jigsaw dataset).
//   It will NOT flag harmless sentences containing identity terms.
// ─────────────────────────────────────────────────────────────────────────────
const TOXICITY_MODEL = "protectai/unbiased-toxic-roberta-onnx"
const TOXICITY_THRESHOLD = 0.5

const TOXICITY_REASON_MAP: Record<string, string> = {
  severe_toxicity: "Severely Harmful Content",
  threat: "Threats & Violence",
  identity_attack: "Hate Speech",
  insult: "Harassment & Insults",
  obscene: "Obscene Language",
  toxicity: "Toxic Content",
  sexual_explicit: "Explicit Content"
}

export class NanoClassifier {
  static sessionPromise: Promise<any> | null = null

  static async getSession() {
    if (!this.sessionPromise) {
      this.sessionPromise = (window as any).ai.createTextSession()
    }
    return this.sessionPromise
  }

  static async analyze(text: string) {
    try {
      const session = await this.getSession()
      const response = await session.prompt(text)
      return response.trim().toUpperCase()
    } catch (error) {
      console.error("NanoClassifier error:", error)
      return "SAFE"
    }
  }
}

class ToxicityClassifier {
  static instance: ReturnType<typeof pipeline> | null = null
  private static cache = new Map<string, Record<string, number>>()
  private static initializationPromise: Promise<any> | null = null

  static async getInstance() {
    if (this.instance) return this.instance

    if (!this.initializationPromise) {
      console.log("[Neoblocker] Loading Toxicity model on CPU (WASM)...")
      modelStatuses.toxicity = "loading"
      broadcastStatus()

      this.initializationPromise = pipeline(
        "text-classification",
        TOXICITY_MODEL,
        {
          model_file_name: "../model"
        }
      )
        .then((pipe) => {
          this.instance = pipe as any
          console.log("[Neoblocker] Toxicity model loaded.")
          modelStatuses.toxicity = "loaded"
          broadcastStatus()
          return this.instance
        })
        .catch((err) => {
          console.error("[Neoblocker] Failed to load Toxicity model:", err)
          modelStatuses.toxicity = "error"
          broadcastStatus()
          this.instance = null
          this.initializationPromise = null
          throw err
        })
    }

    return this.initializationPromise
  }

  static unload() {
    this.instance = null
    this.initializationPromise = null
    modelStatuses.toxicity = "idle"
    broadcastStatus()
  }

  static async analyze(text: string): Promise<Record<string, number>> {
    if (this.cache.has(text)) {
      return this.cache.get(text)!
    }

    const classifier = await this.getInstance()
    // Pass topk as a runtime inference option (not top_k) to get all label scores
    const results = (await (classifier as any)(text.slice(0, 512), {
      topk: 16
    })) as Array<{ label: string; score: number }>

    const scores: Record<string, number> = {}
    for (const r of results) {
      scores[r.label] = r.score
    }

    // Limit cache size to prevent memory leaks in long sessions
    if (this.cache.size > 1000) {
      const firstKey = this.cache.keys().next().value
      if (firstKey) this.cache.delete(firstKey)
    }
    this.cache.set(text, scores)

    return scores
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tier 2: Bias & Clickbait Classifier
//   Model: protectai/distilroberta-bias-onnx
//   Labels: BIASED / NON-BIASED
//   Trained to detect political/media bias, opinionated slant, and clickbait.
// ─────────────────────────────────────────────────────────────────────────────
const BIAS_MODEL = "protectai/distilroberta-bias-onnx"
const BIAS_THRESHOLD = 0.5

class BiasClassifier {
  static instance: ReturnType<typeof pipeline> | null = null
  private static cache = new Map<string, number>()
  private static initializationPromise: Promise<any> | null = null

  static async getInstance() {
    if (this.instance) return this.instance

    if (!this.initializationPromise) {
      console.log("[Neoblocker] Loading Bias model on CPU (WASM)...")
      modelStatuses.bias = "loading"
      broadcastStatus()

      this.initializationPromise = pipeline("text-classification", BIAS_MODEL, {
        model_file_name: "../model"
      })
        .then((pipe) => {
          this.instance = pipe as any
          console.log("[Neoblocker] Bias model loaded.")
          modelStatuses.bias = "loaded"
          broadcastStatus()
          return this.instance
        })
        .catch((err) => {
          console.error("[Neoblocker] Failed to load Bias model:", err)
          modelStatuses.bias = "error"
          broadcastStatus()
          this.instance = null
          this.initializationPromise = null
          throw err
        })
    }

    return this.initializationPromise
  }

  static unload() {
    this.instance = null
    this.initializationPromise = null
    modelStatuses.bias = "idle"
    broadcastStatus()
  }

  static async analyze(text: string): Promise<number> {
    if (this.cache.has(text)) {
      return this.cache.get(text)!
    }

    const classifier = await this.getInstance()
    const results = (await (classifier as any)(text.slice(0, 512))) as Array<{
      label: string
      score: number
    }>
    const result = results[0]
    const biasScore = result && result.label === "BIASED" ? result.score : 0

    if (this.cache.size > 1000) {
      const firstKey = this.cache.keys().next().value
      if (firstKey) this.cache.delete(firstKey)
    }
    this.cache.set(text, biasScore)

    return biasScore
  }
}

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
  // Education & History
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

// Pre-compiled regex with word boundaries to optimize search performance and accuracy
const SAFE_CONTEXT_REGEX = new RegExp(
  `\\b(${SAFE_CONTEXT_KEYWORDS.map((kw) => kw.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")).join("|")})\\b`,
  "i"
)

function normalizeText(str: string): string {
  return str.replace(/\s+/g, " ").trim()
}

// Bolt Optimization: Hoist hate keywords out of the analyze function to avoid repeated allocations.
const HATE_KEYWORDS = [
  "kkk",
  "white supremacist",
  "grand wizard",
  "neo-nazi",
  "racist",
  "racism"
]

// Bolt Optimization: Cache the parsed array of exception keywords similarly
// to avoid repeated parsing logic inside tight loops.
let cachedExceptionsString: string | null = null
let cachedExceptionsArray: string[] = []

// ─────────────────────────────────────────────────────────────────────────────
// Main Entry Point: analyzeContent
// ─────────────────────────────────────────────────────────────────────────────
export async function analyzeContent(
  text: string,
  settings: ExtensionSettings,
  isTitle: boolean = false
): Promise<{ action: "LOCAL_BLOCK" | "SAFE"; reason?: string }> {
  try {
    const cleanText = normalizeText(text)
    if (cleanText.length < 12) return { action: "SAFE" }
    const lowerText = cleanText.toLowerCase()

    // User-configured exceptions check (e.g. mrbeast, ludwig, jojo)
    if (settings.exceptions) {
      if (settings.exceptions !== cachedExceptionsString) {
        cachedExceptionsString = settings.exceptions
        cachedExceptionsArray = settings.exceptions
          .split(",")
          .map((kw) => kw.trim().toLowerCase())
          .filter((kw) => kw.length > 0)
      }

      const matchedKeyword = cachedExceptionsArray.find((kw) =>
        lowerText.includes(kw)
      )
      if (matchedKeyword) {
        console.log(
          `[Neoblocker] Exception matched: "${matchedKeyword}". Bypassing analysis.`
        )
        return { action: "SAFE" }
      }
    }

    const isSafeContext = SAFE_CONTEXT_REGEX.test(cleanText)

    // Run classifiers in parallel
    const promises: [Promise<Record<string, number>>, Promise<number>] = [
      settings.enableToxicity
        ? ToxicityClassifier.analyze(cleanText).catch((err) => {
            console.error("[Neoblocker] Toxicity analysis failed:", err)
            return {}
          })
        : Promise.resolve({}),
      settings.enableBias && !isSafeContext && !isTitle
        ? BiasClassifier.analyze(cleanText).catch((err) => {
            console.error("[Neoblocker] Bias analysis failed:", err)
            return 0
          })
        : Promise.resolve(0)
    ]

    const [toxScores, biasScore] = await Promise.all(promises)

    if (!settings.enableToxicity) ToxicityClassifier.unload()
    if (!settings.enableBias) BiasClassifier.unload()

    const toxicity = toxScores["toxicity"] || 0
    const severe_toxicity = toxScores["severe_toxicity"] || 0
    const obscene = toxScores["obscene"] || 0
    const threat = toxScores["threat"] || 0
    const insult = toxScores["insult"] || 0
    let identity_attack = toxScores["identity_attack"] || 0
    const sexual_explicit = toxScores["sexual_explicit"] || 0

    // Elevate identity attack score for explicit hate speech/extremist keywords (e.g. kkk, white supremacist, grand wizard, racist)
    const hasHateKeyword = HATE_KEYWORDS.some((kw) => lowerText.includes(kw))
    if (hasHateKeyword && settings.enableToxicity) {
      console.log(
        "[Neoblocker] Hate/racism topic keyword detected. Elevating identity_attack score to 0.85."
      )
      identity_attack = Math.max(identity_attack, 0.85)
    }

    const userToxLimit =
      settings.toxicityThreshold !== undefined
        ? settings.toxicityThreshold
        : 0.55
    const userRacismLimit =
      settings.racismThreshold !== undefined ? settings.racismThreshold : 0.25
    const userBiasLimit =
      settings.biasThreshold !== undefined ? settings.biasThreshold : 0.7

    // ───────────────────────────────────────────────────────────────────────────
    // Pass One: The Title Scan (Fast-Fail Layer)
    // ───────────────────────────────────────────────────────────────────────────
    if (isTitle) {
      if (settings.enableToxicity) {
        // 1. Extreme Title Violations
        if (sexual_explicit >= 0.85) {
          return { action: "LOCAL_BLOCK", reason: "Explicit Content (Title)" }
        }
        if (threat >= 0.8) {
          return { action: "LOCAL_BLOCK", reason: "Threats & Violence (Title)" }
        }

        // 2. Combined Title Context
        const identityAttackLimit = Math.min(userRacismLimit, 0.45)
        const toxicityLimitForTitle = Math.min(userToxLimit, 0.35)
        if (
          identity_attack >= identityAttackLimit &&
          toxicity >= toxicityLimitForTitle
        ) {
          return {
            action: "LOCAL_BLOCK",
            reason: "Hate Speech & Discrimination (Title)"
          }
        }

        const severeToxLimitForTitle = Math.min(userToxLimit * 0.8, 0.4)
        const insultLimitForTitle = Math.min(userToxLimit * 0.8, 0.4)
        if (
          severe_toxicity >= severeToxLimitForTitle &&
          insult >= insultLimitForTitle
        ) {
          return {
            action: "LOCAL_BLOCK",
            reason: "Hostile / Harassing Content (Title)"
          }
        }
      }
      // If the title does not trigger the above, pass to Deep Scan
      return { action: "SAFE" }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // Pass Two: The Deep Scan (Subtitles and Comments)
    // ───────────────────────────────────────────────────────────────────────────
    if (settings.enableToxicity) {
      // 1. High-Priority Safety Interceptors
      if (threat >= 0.35) {
        return { action: "LOCAL_BLOCK", reason: "Threats & Violence" }
      }
      if (sexual_explicit >= 0.75) {
        return { action: "LOCAL_BLOCK", reason: "Explicit Content" }
      }

      // 2. The Positivity Buffer (Educational Protection)
      let blockIdentity = false
      if (identity_attack >= userRacismLimit) {
        if (identity_attack <= 0.5) {
          if (severe_toxicity >= 0.1 || insult >= 0.2) {
            blockIdentity = true
          } else {
            console.log(
              `[Neoblocker] Positivity Buffer triggered. Ignored identity_attack of ${identity_attack.toFixed(2)}.`
            )
          }
        } else {
          blockIdentity = true
        }
      }
      if (blockIdentity) {
        return { action: "LOCAL_BLOCK", reason: "Hate Speech & Discrimination" }
      }

      // 3. The Harassment Gate
      if (settings.enableObscene) {
        if (obscene >= 0.75 && insult >= 0.65 && severe_toxicity >= 0.2) {
          return { action: "LOCAL_BLOCK", reason: "Abusive Harassment" }
        }
      }

      // 4. Cumulative Toxicity Score
      const toxicityScore =
        toxicity * 0.4 + insult * 0.3 + severe_toxicity * 0.3
      if (toxicityScore >= userToxLimit) {
        return { action: "LOCAL_BLOCK", reason: "Toxic / Hostile Content" }
      }
    }

    // 5. The Rage-Bait Gate (Bias & Clickbait)
    if (settings.enableBias && !isSafeContext) {
      if (biasScore >= userBiasLimit && toxicity >= 0.4) {
        return {
          action: "LOCAL_BLOCK",
          reason: "Rage-Bait / Clickbait Content"
        }
      }
    }

    return { action: "SAFE" }
  } catch (error) {
    console.error("Analysis pipeline failed:", error)
    return { action: "SAFE" }
  }
}

export function getModelStatuses(): ModelStatuses {
  return { ...modelStatuses }
}
