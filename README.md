# Neoblocker

I built Neoblocker to solve a specific problem: static blocklists miss context. This is an offline content firewall that runs directly inside the browser. Instead of relying on rigid rules, the extension runs machine learning models locally to analyze page text in real-time, catching and filtering out unwanted content before it ever hits the screen.

## Key Features

- **Local Inference:** Text analysis happens entirely inside the browser. I built it this way so we make absolutely zero external API calls. Your browsing data never leaves your machine.
- **Shadow DOM Isolation:** The extension UI renders securely inside a Shadow DOM using React's `createPortal`. We handle UI injection this way to isolate our components, ensuring our CSS doesn't leak out and host page stylesheets don't break our layout.
- **Dynamic CSS Scoping:** To guarantee predictable styling across unpredictable websites, the extension transforms Tailwind CSS on the fly. It dynamically replaces `:root` selectors with `:host(plasmo-csui)` and converts `rem` units to `px` based on a strict 16px baseline.

## Tech Stack & Rationale

I chose this stack to keep the extension development fast and predictable while maintaining a robust injected UI:

- **Plasmo:** The foundational build system. It abstracts away the heavy boilerplate required for Manifest V3 generation and gives us reliable hot-reloading out of the box.
- **React:** Handles state and rendering. It is critical for managing the complex lifecycles of injected UI components isolated within the Shadow DOM.
- **TailwindCSS:** Accelerates our styling workflow. By layering custom processing logic over it, we prevent CSS collisions between the extension and whatever wild styles a host website might be running.
- **@xenova/transformers:** The core logic engine. It lets us run machine learning models locally via WebAssembly, powering the real-time content filtering without needing to spin up or maintain a backend server.

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
