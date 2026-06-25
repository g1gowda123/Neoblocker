# Neoblocker

I built Neoblocker to be an offline content firewall that lives right inside your browser. Static blocklists usually miss the context of what you're reading, so I designed this extension to run machine learning models locally. It reads page text in real-time and dynamically filters out unwanted content before it even hits your screen.

## Key Features

- **Local Inference:** All text analysis runs locally in the browser. I built it this way so we make zero external API calls—your browsing data never leaves your machine.
- **Shadow DOM Isolation:** The extension UI renders securely inside a Shadow DOM using React's `createPortal`. We handle UI injection this way to guarantee our CSS doesn't leak out, and host page stylesheets don't break our components.
- **Dynamic CSS Scoping:** To make sure styling stays predictable across any website you visit, the extension transforms Tailwind CSS on the fly. It replaces `:root` selectors with `:host(plasmo-csui)` and converts all `rem` units to `px` based on a strict 16px baseline.

## Tech Stack & Rationale

I chose this specific stack to keep the development experience sane while building a robust injected UI:

- **Plasmo:** The core build system. It handles the underlying architecture, stripping away the heavy boilerplate needed for Manifest V3 generation and giving us reliable hot-reloading.
- **React:** Manages state and rendering. It handles the messy lifecycle logic of injecting components isolated within the Shadow DOM.
- **TailwindCSS:** Speeds up the styling process. By writing a custom processing layer on top, we avoid nasty CSS conflicts between the extension and random host websites.
- **@xenova/transformers:** The core logic engine. It lets the extension execute machine learning models locally via WebAssembly, running real-time content filtering without ever talking to a backend server.

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

Once the dev server is up, load the unpacked extension into your browser. For Chrome:
- Navigate to the extensions page.
- Toggle **Developer mode** on.
- Click **Load unpacked**.
- Select the `build/chrome-mv3-dev` directory.

To create an optimized production build, run:
```bash
npm run build
```
This generates the final bundle ready to zip and publish.
