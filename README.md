# Neoblocker

Neoblocker is a content firewall that runs entirely in your browser. I built this because static blocklists are too rigid for modern web browsing. Instead of matching URLs against a list, the extension runs local machine learning models to analyze text on the page and filter out unwanted content before it renders.

## Key Features

- **Local Inference:** All text analysis happens directly in the browser. We don't make any external API calls, and your data never leaves your machine.
- **Shadow DOM Isolation:** To avoid style conflicts with the websites you visit, the extension UI renders inside a Shadow DOM using React's `createPortal`. This guarantees our styles don't leak out and host styles don't bleed in.
- **Dynamic CSS Scoping:** We transform Tailwind CSS on the fly. By replacing `:root` with `:host(plasmo-csui)` and converting `rem` units to `px` based on a 16px baseline, the UI remains perfectly styled regardless of the target site's underlying CSS.

## Tech Stack & Rationale

I chose tools that handle the heavy lifting of extension architecture so I could focus on the filtering logic:

- **Plasmo:** Extension development is notoriously finicky. Plasmo handles the build system, manifest generation, and hot-reloading, abstracting away the typical boilerplate.
- **React:** Managing complex, injected UI components across different DOM states is difficult. React handles the state and rendering logic cleanly, especially within our Shadow DOM constraints.
- **TailwindCSS:** Provides rapid, utility-first styling. We layer custom processing on top of it to ensure absolute CSS isolation from the host page.
- **@xenova/transformers:** The core logic engine. It allows us to run machine learning models locally via WebAssembly, providing the raw filtering power without sacrificing privacy.

## Setup & Usage

To build and run the project locally:

1. Install the dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

Once the server is running, load the extension into your browser. In Chrome, navigate to your extensions page, enable **Developer mode**, click **Load unpacked**, and select the `build/chrome-mv3-dev` directory.

To generate a production build:
```bash
npm run build
```
This produces the final, optimized output ready for publishing.

## Disclosure

For full transparency: I used AI tools to help develop this extension. Thanks to **google antigravity** and **jules** for assisting with the code, tracking down bugs, and structuring this documentation.
