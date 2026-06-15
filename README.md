# Neoblocker

I built Neoblocker to function as an intelligent content firewall directly in the browser. Static blocklists are brittle, so I designed this extension to run local machine learning models that analyze DOM text and dynamically filter unwanted content before it renders.

## Key Features

- **Local Inference:** I handle text analysis entirely within the browser. This means zero external API calls and complete data privacy, as no user data ever leaves the machine.
- **Shadow DOM Isolation:** I inject the extension UI into host pages using React's `createPortal` attached to a Shadow DOM. This establishes a strict boundary, preventing the host's CSS from overwriting the interface and stopping our styles from leaking out.
- **Dynamic CSS Scoping:** We process Tailwind CSS dynamically during injection. By replacing `:root` selectors with `:host(plasmo-csui)` and converting `rem` units to strict `px` values tied to a 16px baseline, the styling remains solid regardless of how chaotic the target website's stylesheets are.

## Tech Stack & Rationale

I selected this stack to balance rapid development with robust execution inside the constrained environment of a browser extension.

- **Plasmo:** I use Plasmo as the foundational build framework. It handles the underlying extension architecture, stripping away the standard boilerplate for Manifest V3 generation and giving us reliable hot-reloading out of the box.
- **React:** React manages the state and rendering logic. It is particularly effective here for handling the complex lifecycles of injected UI elements isolated inside the Shadow DOM.
- **TailwindCSS:** Tailwind speeds up the styling layer. We add custom processing on top of it to guarantee CSS isolation when injecting into unpredictable external DOMs.
- **@xenova/transformers:** This provides the core logic engine for content filtering. I use it to load and execute machine learning models locally via WebAssembly, allowing for heavy text analysis without needing a backend.

## Setup & Usage

To build and run the project locally, follow these steps.

1. Install the dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

Once the server is running, you need to load the extension into your browser. In Chrome, navigate to the extensions page, enable Developer mode, select "Load unpacked", and point it to the `build/chrome-mv3-dev` directory.

To generate a production build, run:
```bash
npm run build
```
This produces the optimized, final assets ready for packaging and publishing.

## Disclosure

For full transparency: I utilized AI tools during the development of this extension. A big shoutout to **google antigravity** and **jules** for their assistance with writing code, solving bugs, and drafting this documentation.