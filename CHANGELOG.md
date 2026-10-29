# Changelog

All notable changes to Neoblocker are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and releases use [Semantic Versioning](https://semver.org/).

## [1.2.0] — 2026-10-29

A leaner, faster default build. The toxicity classifier is now bundled, the optional bias model is lazy and off by default, and first-run model bandwidth drops from roughly 208 MB to zero.

### Added

- Bundled 23 MB int8 MiniLM toxicity model (`minuva/MiniLMv2-toxic-jigsaw-onnx`, Apache-2.0), with model provenance and license notice.
- Optional explicit-content keyword heuristic for the compact model.

### Changed

- Toxicity inference is roughly 5× faster and loads in about 0.3 s locally.
- The 83 MB bias model is off by default, downloads only when enabled and a toxic signal is detected, and is skipped entirely for safe text.
- Bias analysis now also applies to toxic titles, improving rage-bait detection without loading the model for every card.
- Hate-speech threshold default lowered to 15% to compensate for the smaller identity-hate head.
- Extension package grows from ~11 MB to ~34 MB unpacked, but removes the 208 MB model download; total first-run bytes are far smaller.

### Fixed

- Compact-model label mapping (`toxic`, `severe_toxic`, `identity_hate`) now feeds the existing decision gates.
- Long/short-title and mild-insult edge cases are covered by a weighted title gate.

## [1.1.0] — 2026-10-29

A usability, reliability, and privacy-focused release. The core filtering pipeline is unchanged, but the extension is smaller, safer, and much easier to control.

### Added

- Master protection switch, deep-scan toggle, and blur/hide mode selector.
- Daily filtered counter, toolbar badge, and reset controls.
- Model status, download progress, error handling, and a one-click **Preload** button.
- **Show anyway** per-card reveal that survives page refreshes (per tab session), and **Allow channel** exceptions.
- Keyword **always block** and **never block** lists.
- Light/dark popup themes and a scrollable, keyboard-accessible 360 px layout.
- Serialized inference queue, bounded LRU caches, fetch timeouts, and bounded request text.
- Validation for video IDs, subtitle hosts, InnerTube API keys, and continuation tokens.
- Settings sanitization, serialized storage writes, and a shared daily stats counter.
- Unit tests for extraction, keyword handling, storage, and detection thresholds; CI workflow.
- New shield icon and rewritten README with install, privacy, architecture, and troubleshooting sections.

### Changed

- Replaced the React/Tailwind content-script styling with a small self-contained overlay stylesheet, preventing host-page CSS bleed.
- Content script is now plain TypeScript (`.ts`), fixing a runtime React error in Plasmo.
- Deep scans only run for visible cards, at most two at a time; titles and comments are processed as soon as they render.
- Narrowed host permissions to YouTube and Hugging Face download hosts.
- Ship only the SIMD WebAssembly binary; the unpacked extension is now about 11 MB instead of 20 MB.
- Modernized CI and Web Store workflows to npm and Node 20.
- README no longer claims the extension is fully offline on first use; model downloads are now documented honestly.

### Fixed

- Cards cached before their titles loaded were never rescanned.
- Transient model/timeout errors were cached as permanently safe.
- Deep scans could re-block a card after the user chose **Show anyway**.
- Comments whose text loaded after the first intersection check were skipped.
- Duplicate/ nested Shorts cards could be counted twice.
- Reveal state was lost on refresh; it is now persisted per tab session.
- Settings and stats writes could race or be overwritten.
- Malformed HTML entities could throw during subtitle/comment parsing.
- Broken rem-conversion stylesheet injection and global host-page CSS pollution.
- Pause now restores filtered items immediately; resume rescans the page.

### Removed

- Unused NanoClassifier API probe.
- Vestigial `api/` FastAPI service and one-off patch scripts.
- ~148 MB of unused ONNX/WASM variants from `assets/wasm` and `static/wasm`.
- The `web_accessible_resources` entry; the WASM runtime is only loaded by the extension service worker.
- Tailwind and PostCSS build dependencies from the popup pipeline.

## [1.0.0]

Initial public version: on-device toxicity/bias models, YouTube card and comment filtering, blur overlay, and basic settings popup.
