# Neoblocker

I built Neoblocker because I wanted an intelligent content firewall that works directly inside the browser. Rather than relying on outdated, static blocklists, this extension runs a local AI model to read page text and filter out unwanted content before it hits the DOM.

## Key Features

- **Local Inference:** We run the text analysis entirely in the browser. No external API calls are made, and no data leaves your machine.
- **Shadow DOM Isolation:** We render the extension UI into a Shadow DOM using React's `createPortal`. This guarantees our CSS won't leak into the host page, and the host page's CSS won't break our UI.
- **Dynamic CSS Scoping:** We transform Tailwind CSS on the fly. By replacing `:root` selectors with `:host(plasmo-csui)` and converting `rem` units to `px` based on a strict 16px baseline, we ensure predictable styling across any target site.

## Tech Stack & Rationale

I chose a stack that keeps extension development predictable while allowing for flexible, robust UI injection:

- **Plasmo:** We use Plasmo for the build system and underlying architecture. It handles the heavy lifting for manifest generation and hot-reloading, saving a ton of boilerplate.
- **React:** We use React to manage state and rendering. It is particularly effective for handling the complex lifecycle of injected UI elements inside a Shadow DOM.
- **TailwindCSS:** We use Tailwind for rapid styling, layering custom processing logic on top to prevent style conflicts with the host website.
- **@xenova/transformers:** We rely on this library to run our machine learning models locally via WebAssembly. It serves as the logic engine powering the content filters.

## Setup & Usage

To build and run the project locally, follow these steps:

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

Once the server is running, load the extension into your browser. If you are using Chrome: go to your extensions page, enable Developer mode, click "Load unpacked", and select the `build/chrome-mv3-dev` directory.

To create an optimized production build for publishing, run:
```bash
npm run build
```

## Disclosure

For full transparency: I used AI tools to help build this extension. Thanks to **google antigravity** and **jules** for helping write code, debug issues, and format this documentation.