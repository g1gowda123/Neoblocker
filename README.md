# Neoblocker

I built Neoblocker because traditional static blocklists fail to understand context. This is a fully offline browser extension that runs machine learning models locally to analyze page text in real-time. We catch and filter out unwanted content dynamically before it even renders on the screen.

## Key Features

- **Local Inference:** Text analysis happens entirely inside the browser. I implemented this to guarantee zero external API calls. The data never leaves the machine.
- **Shadow DOM Isolation:** The extension UI renders inside a Shadow DOM using React's `createPortal`. We handle UI injection this way to prevent our CSS from leaking out or getting overwritten by unpredictable host page stylesheets.
- **Dynamic CSS Scoping:** To ensure consistent styling across different websites, the extension transforms Tailwind CSS on the fly. It dynamically replaces `:root` selectors with `:host(plasmo-csui)` and converts `rem` units to `px` based on a strict 16px baseline.

## Tech Stack & Rationale

I selected this stack to keep the extension architecture clean while maintaining a robust injected UI:

- **Plasmo:** The foundational build system. We use Plasmo to abstract away the heavy boilerplate required for Manifest V3 generation and to enable reliable hot-reloading.
- **React:** Manages state and rendering logic. We rely on React to handle the lifecycle of complex UI components isolated inside the Shadow DOM.
- **TailwindCSS:** Used for rapid styling. By layering custom processing logic on top of Tailwind, we prevent CSS conflicts between the extension and host websites.
- **@xenova/transformers:** The core logic engine. It enables the extension to execute machine learning models locally via WebAssembly, handling real-time content filtering without a backend server.

## Setup & Usage

To run the project locally, follow these steps:

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
