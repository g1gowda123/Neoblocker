---
trigger: manual
---

# Project: Neoblocker

Neoblocker is a Manifest V3 browser extension built with Plasmo. React is used only for the popup (`src/popup.tsx`); the YouTube content script is plain TypeScript and the popup styles are hand-written CSS. Do not reintroduce Tailwind or a React content-script component.

## Local AI architecture

Inference runs on-device with Transformers.js and WebAssembly:

1. **Toxicity classifier** — a bundled 23 MB int8 MiniLM (`minuva/MiniLMv2-toxic-jigsaw-onnx`) detects toxicity, severe toxicity, obscenity, threats, insults, and identity hate. The ONNX file has unused training/backend opset imports stripped so it runs under the bundled ORT 1.14; see `assets/models/minilm/NOTICE.md`.
2. **Bias classifier** — optional `protectai/distilroberta-bias-onnx` provides a supporting bias/rage-bait signal. It is off by default, downloads only when enabled and toxicity is already present, and is not a standalone political-opinion filter.
3. **Rules** — user keyword lists and exceptions are checked before ML; a safe-context buffer reduces false positives.

The toxicity model is bundled, so a default install performs **no model download**. The optional bias model downloads once from Hugging Face and is cached by the browser. Do not claim the extension is fully offline when bias is enabled on first use. No inference API or telemetry is permitted.

## Boundaries

- `src/contents/content-observer.ts` observes the YouTube DOM, extracts titles/channels/comments, applies overlays, and persists per-tab reveal choices in `sessionStorage`. Deep scan is opt-in and only runs for cards after a viewport dwell; it fetches the watch page and subtitles, never comments.
- `src/background.ts` owns message validation, the network boundary, model execution, caches, stats, and the toolbar badge.
- `src/utils/ai-router.ts` serializes inference and owns decision gates. Keep thresholds tested.
- `src/utils/storage.ts` serializes writes and sanitizes settings/stats.

## Security and privacy rules

- Treat content-script messages as untrusted: validate action names, video IDs, and lengths; never return raw exception details.
- Validate URLs extracted from YouTube HTML before fetching. Only HTTPS YouTube/googlevideo hosts are allowed for subtitles.
- Every network request needs a timeout and an output-size bound.
- Keep host permissions limited to YouTube and model-download hosts. No analytics, remote code, cookies, tabs, or history permissions.
- Do not inject Tailwind/preflight or other global CSS into the host page; use the scoped overlay stylesheet.
- Add tests for parsing, validation, storage, and detection-gate changes. Run `npm run check` and `npm run build` before shipping.
