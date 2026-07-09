# Neoblocker

Static blocklists cannot keep up with the volume of dynamic content on the modern web. I built Neoblocker to solve this problem by shifting from static lists to real-time analysis.

This project is a strictly offline content firewall that runs directly inside your browser. Instead of relying on outdated lists of blocked domains, Neoblocker runs local machine learning models to analyze page text as you browse. We intercept and filter unwanted content locally before the browser paints it to the screen.

## Key Features

- **Local Inference:** I built this to guarantee zero external API calls. All text analysis happens securely on the client, so your browsing data never leaves your machine.
- **Shadow DOM Isolation:** Injecting UI into arbitrary websites frequently breaks host layouts due to CSS collisions. We handle this by rendering the extension UI securely inside a Shadow DOM using React's `createPortal`.
- **Dynamic CSS Scoping:** Host websites are unpredictable. To maintain consistent styling, we transform Tailwind CSS on the fly by replacing `:root` selectors with `:host(plasmo-csui)` and converting `rem` units to `px` based on a strict 16px baseline.

## Tech Stack & Rationale

I chose this stack to move fast while ensuring the injected UI remains robust, regardless of the CSS the host site uses.

- **Plasmo:** Building for Manifest V3 requires significant boilerplate. Plasmo acts as our build system, stripping out configuration overhead and providing reliable hot-reloading.
- **React:** Managing the lifecycle of UI components isolated within a Shadow DOM gets messy. React handles our state and rendering logic cleanly, keeping the component tree manageable.
- **TailwindCSS:** I use Tailwind to iterate quickly on styling. By layering custom processing logic on top, we keep the speed of utility classes while preventing our CSS from leaking into the host page.
- **@xenova/transformers:** This package is our core engine. We use it to run machine learning models locally via WebAssembly, powering real-time filtering completely offline without a backend server.

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
