# Neoblocker

Static blocklists struggle to keep up with the sheer volume of dynamic content on the modern web. I built Neoblocker to address this by moving away from hardcoded domain lists and focusing on real-time content analysis.

Neoblocker is a strictly offline content firewall that runs directly inside the browser. It executes local machine learning models via WebAssembly to analyze page text as you browse. We intercept and filter out unwanted content locally, right before the browser paints it to the screen.

## Key Features

- **Local Inference:** I engineered this to ensure zero external API calls. All text analysis happens securely on the client, so your browsing data never leaves your machine.
- **Shadow DOM Isolation:** Injecting UI into arbitrary websites frequently breaks host layouts due to CSS collisions. We handle this by rendering the extension UI securely inside a Shadow DOM using React's `createPortal`.
- **Dynamic CSS Scoping:** Host websites are completely unpredictable. To maintain consistent styling, we transform Tailwind CSS on the fly, replacing `:root` selectors with `:host(plasmo-csui)` and converting `rem` units to `px` based on a strict 16px baseline.

## Tech Stack & Rationale

I selected this stack to prioritize iteration speed while ensuring the injected UI remains isolated and robust, regardless of how messy the host site's CSS gets.

- **Plasmo:** Building for Manifest V3 introduces massive boilerplate. Plasmo acts as the build system, stripping out configuration overhead and giving us reliable hot-reloading out of the box.
- **React:** Managing the lifecycle of UI components isolated within a Shadow DOM gets complicated fast. React handles our state and rendering logic cleanly, keeping the component tree maintainable.
- **TailwindCSS:** I use Tailwind to move quickly on styling. By layering custom processing logic on top, we keep the speed of utility classes while guaranteeing our CSS won't leak into the host page.
- **@xenova/transformers:** This package is our core engine. We use it to execute machine learning models locally using WebAssembly, which powers our real-time filtering completely offline without relying on a backend server.

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
