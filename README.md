# Neoblocker

I built Neoblocker to solve a specific problem: static blocklists miss context. This extension acts as an offline content firewall directly inside the browser. By running machine learning models locally, it analyzes page text in real-time and dynamically filters out unwanted content before it renders on the screen.

## Key Features

- **Local Inference:** All text analysis runs entirely in the browser. I built this to guarantee zero external API calls, meaning your browsing data never leaves your machine.
- **Shadow DOM Isolation:** The extension UI renders inside a Shadow DOM using React's `createPortal`. We handle UI injection this way to strictly isolate our components and prevent CSS leakage or host page styling conflicts.
- **Dynamic CSS Scoping:** To ensure predictable styling across any website, the extension transforms Tailwind CSS on the fly. We achieve this by replacing `:root` selectors with `:host(plasmo-csui)` and converting `rem` units to `px` against a strict 16px baseline.

## Tech Stack & Rationale

I chose this stack to keep the extension architecture predictable while maintaining a robust, injected UI:

- **Plasmo:** The foundational build system. It abstracts the heavy boilerplate required for Manifest V3 generation and enables reliable hot-reloading.
- **React:** Manages state and rendering logic. We rely on it to handle the complex lifecycle of our injected UI components isolated within the Shadow DOM.
- **TailwindCSS:** Used for rapid styling. By applying custom processing on top, we prevent CSS conflicts between the extension and the unpredictable styles of host websites.
- **@xenova/transformers:** The core logic engine. It lets the extension run machine learning models locally via WebAssembly, handling real-time content filtering without a backend server.

## Setup & Usage

To build and run the project locally, follow these steps:

1. Install the dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

Once the dev server is running, load the unpacked extension into your browser. For Chrome:
- Navigate to the extensions page.
- Toggle **Developer mode** on.
- Click **Load unpacked**.
- Select the `build/chrome-mv3-dev` directory.

To create an optimized production build, run:
```bash
npm run build
```
This generates the final bundle ready to zip and publish.
