# Neoblocker

I built Neoblocker to serve as an intelligent content firewall right inside the browser. Instead of relying on static blocklists, this extension runs local AI models to analyze page text and dynamically filter out unwanted content before you see it.

## Key Features

- **Local Inference:** Analyzes text entirely within the browser, meaning no external API calls and no data leaves your machine.
- **Shadow DOM Isolation:** Renders the extension UI using React's `createPortal` into a Shadow DOM. This prevents the extension's CSS from leaking into or being overwritten by the host page.
- **Dynamic CSS Scoping:** Transforms Tailwind CSS on the fly by replacing `:root` selectors with `:host(plasmo-csui)` and converting `rem` units to `px` based on a 16px baseline, ensuring predictable styling regardless of the target site's CSS.

## Tech Stack & Rationale

I chose tools that make extension development predictable while keeping the UI flexible and robust:

- **Plasmo:** Provides the build system and underlying architecture for the extension. It abstracts away a lot of boilerplate associated with manifest generation and hot-reloading.
- **React:** Handles the state and rendering logic, especially crucial for managing complex, injected UI elements within the Shadow DOM.
- **TailwindCSS:** Speeds up styling, with custom processing logic layered on top to prevent style conflicts with the websites the extension runs on.
- **@xenova/transformers:** Enables running the machine learning models locally via WebAssembly, acting as the logic engine for the content filtering.

## Setup & Usage

To build and run the project locally, use the following steps:

1. Install all the packages:
```bash
npm install
```

2. Start the dev server:
```bash
npm run dev
```

After it starts, you can load the extension into your browser. If you're on Chrome, just go to your extensions page, turn on Developer mode, click "Load unpacked", and select the `build/chrome-mv3-dev` folder.

To create a production build, just run:
```bash
npm run build
```
This gives you the final, optimized files you can zip up and publish.

## Disclosure

Just to be completely transparent: I used some AI tools to help build this extension. A big shoutout to **google antigravity** and **jules** for helping me write code, solve bugs, and draft this documentation.
