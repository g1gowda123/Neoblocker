# Neoblocker

I built Neoblocker because static blocklists lack the context needed to filter modern web content effectively. This project is a fully offline content firewall that runs entirely inside your browser. It uses local machine learning models to analyze page text in real time, catching and filtering out toxic content before it renders on your screen.

## Key Features

- **Local Inference:** Privacy is the core constraint. All text analysis runs entirely on your machine. I implemented this to ensure zero external API calls are made, so your browsing data never leaves your device.
- **Shadow DOM Isolation:** The extension UI is securely injected into a Shadow DOM via React's `createPortal`. We handle UI injection this way to prevent our styles from leaking out and to stop unpredictable host stylesheets from breaking our interface.
- **Dynamic CSS Scoping:** To guarantee predictable styling across completely different websites, we transform Tailwind CSS on the fly. This is done by dynamically replacing `:root` selectors with `:host(plasmo-csui)` and converting `rem` units to `px` against a strict 16px baseline.

## Tech Stack & Rationale

I selected this stack to keep extension development sane and predictable while maintaining a robust, injected UI:

- **Plasmo:** The foundational build system. It handles the underlying architecture, abstracting away the heavy boilerplate required for Manifest V3 generation and giving us reliable hot-reloading.
- **React:** Manages state and rendering. It is critical here for handling the complex lifecycle of injected UI components that are isolated within the Shadow DOM.
- **TailwindCSS:** Chosen for rapid styling. By layering custom processing logic on top of it, we avoid CSS conflicts between the extension and whatever site the user is visiting.
- **@xenova/transformers:** The core logic engine. It allows us to run machine learning models locally via WebAssembly, powering the real-time inference without touching a backend server.

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
- Navigate to your extensions page.
- Toggle **Developer mode** on.
- Click **Load unpacked**.
- Select the `build/chrome-mv3-dev` directory.

To create an optimized production build, run:
```bash
npm run build
```
This generates the final bundle ready to zip and publish.
