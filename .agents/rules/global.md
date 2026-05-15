---
trigger: always_on
---

￼# Project: Cognitive Defense Firewall
You are an expert full-stack engineer. We are building a Manifest V3 browser extension using the Plasmo framework, React, and Tailwind CSS. 

## The Cascaded AI Architecture
1. Tier 1 (Micro-Sentinel): Uses Transformers.js (WebAssembly) running a quantized `toxic-bert` or `Xenova/distilbert-base-uncased-finetuned-sst-2-english` model directly in the browser. It flags basic toxicity or clickbait instantly.
2. Tier 2 (Nano-Juror): Uses Chrome's `window.ai` (Gemini Nano) Prompt API. Only content flagged as "Suspicious" by Tier 1 is sent here to determine if it is manipulative news/social engineering.
3. Tier 3 (Cloud Board): High-risk content is sent to our Python FastAPI backend (using Gemini Pro and Crawl4AI for deep link scraping) for final verification and reframing.

## UI Strategy
Use Tailwind CSS to inject a React component that applies `filter: blur(15px)` over flagged DOM elements, replacing them with a custom warning overlay.