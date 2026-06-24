# Neoblocker

I built Neoblocker to serve as an offline content firewall directly inside the browser. Static blocklists often fail because they lack context, so I designed this extension to run machine learning models locally. It analyzes page text in real time and dynamically filters out unwanted content before it renders on your screen.

## Key Features

- **Local Inference:** All text analysis runs entirely in the browser. I built it this way so we make zero external API calls—your browsing data stays entirely on your machine.
- **Shadow DOM Isolation:** The extension UI renders securely inside a Shadow DOM via React's `createPortal`. I handle UI injection this way to prevent our CSS from bleeding out, and to stop the host page's stylesheets from breaking our layout.
- **Dynamic CSS Scoping:** To guarantee predictable styling across completely different websites, the extension transforms Tailwind CSS on the fly. We replace `:root` selectors with `:host(plasmo-csui)` and convert `rem` units to `px` against a hard 16px baseline.

## Tech Stack & Rationale

I went with this stack to keep extension development predictable while building a robust injected UI:

- **Plasmo:** The core build system. It handles the underlying architecture, stripping away the heavy boilerplate needed for Manifest V3 generation and giving us reliable hot-reloading.
- **React:** Manages the state and rendering logic. It is strictly necessary here to handle the complex lifecycle of injected UI components isolated within the Shadow DOM.
- **TailwindCSS:** I chose Tailwind to write styles quickly. By layering custom processing logic on top, we prevent CSS conflicts between the extension and the unpredictable styles of host websites.
- **@xenova/transformers:** The core logic engine. It lets the extension run machine learning models locally via WebAssembly, powering the real-time content filtering without needing a backend server.

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
