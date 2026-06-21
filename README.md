# Neoblocker

I built Neoblocker because static blocklists lack the context needed to effectively filter the modern web. It acts as an offline content firewall running directly inside the browser. By executing machine learning models locally, the extension analyzes page text in real-time and strips out unwanted content before it ever renders on your screen.

## Key Features

- **Local Inference:** All text analysis happens entirely within the browser. I implemented this to ensure zero external API calls are made, guaranteeing your browsing data never leaves your local machine.
- **Shadow DOM Isolation:** The extension UI renders securely inside a Shadow DOM using React's `createPortal`. We handle UI injection this way to prevent our CSS from leaking out, and to stop the host page's stylesheets from overwriting our components.
- **Dynamic CSS Scoping:** To guarantee predictable styling across completely different DOM environments, the extension transforms Tailwind CSS on the fly. We do this by replacing `:root` selectors with `:host(plasmo-csui)` and automatically converting `rem` units to `px` against a strict 16px baseline.

## Tech Stack & Rationale

I selected this stack to keep the extension development predictable while maintaining a flexible, isolated UI:

- **Plasmo:** I use Plasmo as the build system. It abstracts away the heavy boilerplate required for Manifest V3 generation and enables reliable hot-reloading.
- **React:** Manages the state and rendering logic. It is critical here for handling the complex lifecycle of UI components isolated within the injected Shadow DOM.
- **TailwindCSS:** I chose Tailwind to accelerate styling. By layering custom processing logic on top, we prevent CSS conflicts between our extension and the unpredictable styles of host websites.
- **@xenova/transformers:** This package serves as our core logic engine. It allows the extension to run machine learning models locally via WebAssembly, powering the real-time content filtering without needing a backend server.

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
