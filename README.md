# Neoblocker

I built Neoblocker to function as an intelligent, offline content firewall directly inside the browser. Traditional static blocklists often miss context, so I designed this extension to run machine learning models locally. It analyzes page text in real-time and dynamically filters out unwanted content before it renders on your screen.

## Key Features

- **Local Inference:** All text analysis happens entirely within the browser. I implemented this to ensure zero external API calls are made, meaning your browsing data never leaves your machine.
- **Shadow DOM Isolation:** The extension UI renders securely inside a Shadow DOM using React's `createPortal`. We handle UI injection this way to prevent our CSS from leaking out or getting overwritten by the host page's stylesheets.
- **Dynamic CSS Scoping:** To guarantee predictable styling across completely different websites, the extension transforms Tailwind CSS on the fly. It does this by replacing `:root` selectors with `:host(plasmo-csui)` and automatically converting `rem` units to `px` against a strict 16px baseline.

## Tech Stack & Rationale

I selected this stack to keep extension development predictable while maintaining a flexible, robust injected UI:

- **Plasmo:** I use Plasmo as the foundational build system. It handles the underlying architecture, abstracting away the heavy boilerplate required for Manifest V3 generation and enabling reliable hot-reloading.
- **React:** React manages the state and rendering logic. It is critical here for handling the complex lifecycle of injected UI components isolated within the Shadow DOM.
- **TailwindCSS:** I chose Tailwind to accelerate styling. By layering custom processing logic on top, we prevent CSS conflicts between the extension and the unpredictable styles of host websites.
- **@xenova/transformers:** This package serves as the core logic engine. It allows the extension to run machine learning models locally via WebAssembly, powering the real-time content filtering without needing a backend server.

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
