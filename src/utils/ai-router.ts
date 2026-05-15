import { pipeline, env } from "@xenova/transformers";

// Configure for Chrome Extension: single-threaded, local WASM (onnxruntime-web 1.14.0)
env.allowLocalModels = false;
env.backends.onnx.wasm.numThreads = 1;
env.backends.onnx.wasm.proxy = false;
env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL("wasm/");

export class SentimentClassifier {
  static instance: any = null;

  static async getInstance() {
    if (this.instance === null) {
      console.log("[Firewall] Initializing local Transformer model... (this may take a minute on first load to download ~260MB)");
      // Using distilbert-base-uncased-finetuned-sst-2-english as requested
      this.instance = await pipeline(
        "text-classification",
        "Xenova/distilbert-base-uncased-finetuned-sst-2-english"
      );
      console.log("[Firewall] Local Transformer model initialized successfully.");
    }
    return this.instance;
  }

  static async analyze(text: string) {
    const classifier = await this.getInstance();
    const results = await classifier(text);
    return results[0];
  }
}

export class NanoClassifier {
  static session: any = null;

  static async getSession() {
    if (!this.session) {
      if (typeof self === 'undefined' || !('ai' in self) || !('languageModel' in (self as any).ai)) {
        throw new Error("self.ai.languageModel is not available in this environment");
      }
      this.session = await (self as any).ai.languageModel.create({
        systemPrompt: "You are a threat triage agent. Analyze this text for subtle misinformation, biased framing, or emotional manipulation. Reply ONLY with 'ESCALATE' or 'SAFE'."
      });
    }
    return this.session;
  }

  static async analyze(text: string): Promise<string> {
    try {
      const session = await this.getSession();
      const response = await session.prompt(text);
      return response.trim().toUpperCase();
    } catch (error) {
      console.error("NanoClassifier error:", error);
      return "SAFE";
    }
  }
}

export async function analyzeContent(text: string) {
  try {
    const sentiment = await SentimentClassifier.analyze(text);
    
    if (sentiment.label === "NEGATIVE") {
      // If highly negative, block immediately
      if (sentiment.score > 0.85) {
        return { action: "LOCAL_BLOCK", reason: "Toxicity" };
      }
      
      // If borderline/suspicious, escalate to Nano
      const nanoResponse = await NanoClassifier.analyze(text);
      if (nanoResponse.includes("ESCALATE")) {
        return { action: "CLOUD_VERIFY" };
      }
    }

    // Default or positive/safe
    return { action: "SAFE" };
  } catch (error) {
    console.error("Analysis pipeline failed:", error);
    return { action: "SAFE" };
  }
}
