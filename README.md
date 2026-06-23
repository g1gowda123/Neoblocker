# Neoblocker

I built Neoblocker because traditional static blocklists fail to understand context. It acts as an offline content firewall directly inside your browser. Instead of relying on rigid keyword rules, I designed the extension to run machine learning models locally. It analyzes page text in real-time and filters out unwanted content before it ever renders on your screen.

## Key Features

- **Local Inference:** I wanted to guarantee privacy, so all text analysis happens entirely within the browser. There are zero external API calls, meaning your browsing data never leaves your machine.
- **Shadow DOM Isolation:** The extension injects its UI into host pages. To prevent our CSS from leaking out—and to stop the host page's stylesheets from breaking our UI—we render everything securely inside a Shadow DOM using React's `createPortal`.
- **Dynamic CSS Scoping:** Building a UI that looks consistent across completely different websites is tough. The extension handles this by transforming Tailwind CSS on the fly. It replaces `:root` selectors with `:host(plasmo-csui)` and automatically converts `rem` units to `px` against a strict 16px baseline.

## Tech Stack & Rationale

I put this stack together to keep extension development predictable while maintaining a flexible, robust injected UI:

- **Plasmo:** Building browser extensions manually involves a lot of tedious configuration. I use Plasmo as the foundational build system because it handles the underlying architecture, abstracting away the heavy boilerplate required for Manifest V3 generation and giving us reliable hot-reloading.
- **React:** Handling the complex lifecycle of injected UI components isolated within the Shadow DOM can get messy. React manages the state and rendering logic cleanly.
- **TailwindCSS:** I chose Tailwind to move fast on styling. By adding custom processing logic on top of it, we prevent CSS specificity conflicts between the extension and the unpredictable styles of host websites.
- **@xenova/transformers:** This package is the core engine for our logic. It lets the extension run machine learning models locally via WebAssembly, powering the real-time content filtering entirely client-side without needing a backend server.

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
