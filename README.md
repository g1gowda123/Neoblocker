# Neoblocker

Static blocklists cannot keep up with the volume of dynamic content on the modern web. I built Neoblocker to solve this by moving away from hardcoded domain lists and focusing purely on real-time content analysis.

Neoblocker is an offline content firewall that runs directly inside the browser. It executes local machine learning models via WebAssembly to analyze page text as you browse. We intercept and filter out unwanted content locally, immediately before the browser paints it to the screen.

## Key Features

- **Local Inference:** I built this to run completely offline. All text analysis happens securely on the client with zero external API calls, ensuring your browsing data never leaves your machine.
- **Shadow DOM Isolation:** Injecting UI into arbitrary websites frequently breaks host layouts due to CSS collisions. We prevent this by rendering the extension UI securely inside a Shadow DOM using React's `createPortal`.
- **Dynamic CSS Scoping:** Host websites are completely unpredictable. To maintain consistent styling without polluting the host page, we transform Tailwind CSS on the fly. This involves replacing `:root` selectors with `:host(plasmo-csui)` and converting `rem` units to `px` based on a strict 16px baseline.

## Tech Stack & Rationale

I chose this stack to prioritize iteration speed while ensuring the injected UI remains isolated and robust, regardless of the host site's underlying CSS.

- **Plasmo:** Building for Manifest V3 introduces significant boilerplate. Plasmo serves as the build system, stripping out configuration overhead and providing reliable hot-reloading out of the box.
- **React:** Managing the lifecycle of UI components isolated within a Shadow DOM gets complicated quickly. React handles the state and rendering logic cleanly, keeping the component tree maintainable.
- **Tailwind CSS:** I use Tailwind to move fast on styling. By layering custom processing logic on top, we maintain the speed of utility classes while guaranteeing our styles will not leak into the host page.
- **@xenova/transformers:** This package is the core engine. We use it to execute machine learning models locally using WebAssembly, powering the real-time filtering completely offline without relying on a backend server.

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

Once the development server is running, load the unpacked extension into your browser. For Chrome:
- Navigate to `chrome://extensions/`.
- Toggle **Developer mode** on.
- Click **Load unpacked**.
- Select the `build/chrome-mv3-dev` directory.

To create an optimized production build, run:
```bash
npm run build
```

This generates the final bundle, ready to zip and publish.
