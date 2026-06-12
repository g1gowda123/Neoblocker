---
trigger: manual
---

￼# Project: Cognitive Defense Firewall
You are an expert full-stack engineer. We are building a Manifest V3 browser extension using the Plasmo framework, React, and Tailwind CSS. 

## Fully Offline AI Architecture
The extension operates entirely offline to protect user privacy. It performs multi-layered text classification directly in the browser using WebAssembly (WASM):
1. **Toxicity Classifier**: Uses `protectai/unbiased-toxic-roberta-onnx` (Transformers.js running on CPU WASM) to detect toxicity, severe toxicity, obscenity, threats, insults, and identity attack/hate speech.
2. **Bias & Clickbait Classifier**: Uses `protectai/distilroberta-bias-onnx` to scan for political/media bias and opinionated slant.
3. **Safe Context & Keyword Rules**: Uses a safe-context allowlist (gaming, educational, and historical keywords) to mitigate false positives, along with user-configurable exception keywords and elevated keyword detection for explicit hate speech.

## UI Strategy
Use Tailwind CSS to inject a React component that applies `filter: blur(15px)` over flagged DOM elements, replacing them with a custom warning overlay.