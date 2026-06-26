# Neoblocker

I built Neoblocker to act as an offline content firewall that runs entirely in your browser. Static blocklists are brittle and often miss context. To fix this, I designed the extension to run machine learning models locally, analyzing page text in real-time and filtering out unwanted content before the browser renders it on your screen.

## Key Features

- **Local Inference:** All text analysis runs inside the browser. I set it up this way to ensure the extension makes zero external API calls. Your browsing data never leaves your machine.
- **Shadow DOM Isolation:** The extension UI renders inside a Shadow DOM using React's `createPortal`. We handle UI injection this way to prevent our CSS from leaking into the host page or being overridden by external stylesheets.
- **Dynamic CSS Scoping:** To keep styling predictable across completely different websites, the extension transforms Tailwind CSS on the fly. It replaces `:root` selectors with `:host(plasmo-csui)` and converts `rem` units to `px` against a strict 16px baseline.

## Tech Stack & Rationale

I chose this stack to keep extension development straightforward while ensuring the injected UI remains isolated and predictable:

- **Plasmo:** I use Plasmo to handle the build process. It manages the underlying architecture, abstracts away Manifest V3 boilerplate, and provides reliable hot-reloading out of the box.
- **React:** React drives the state and rendering logic. It is essential for managing the complex lifecycle of UI components injected into the Shadow DOM.
- **TailwindCSS:** I use Tailwind for fast styling. By layering custom processing logic on top of it, we prevent CSS conflicts between the extension and the host website.
- **@xenova/transformers:** This package handles the machine learning execution. It allows the extension to run models locally via WebAssembly, providing real-time text analysis without a backend server.

## Setup & Usage

To build and run the project locally, run these commands:

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
