# Neoblocker

Static blocklists are fundamentally broken. They cannot keep up with the volume of dynamic content on the web. I built Neoblocker to solve this problem.

This project is a strictly offline content firewall that runs directly inside your browser. Instead of maintaining massive, outdated lists of blocked domains, Neoblocker runs local machine learning models to analyze page text in real time. We intercept and filter unwanted content locally before the browser paints it to the screen.

## Key Features

- **Local Inference:** I built this to guarantee zero external API calls. All text analysis happens securely on the client, meaning your browsing data never leaves your machine.
- **Shadow DOM Isolation:** Injecting UI into arbitrary websites frequently breaks host layouts due to CSS collisions. We handle this by rendering the extension UI securely inside a Shadow DOM using React's `createPortal`.
- **Dynamic CSS Scoping:** Host websites are unpredictable. To maintain consistent styling, we transform Tailwind CSS on the fly. We replace `:root` selectors with `:host(plasmo-csui)` and convert `rem` units to `px` based on a strict 16px baseline.

## Tech Stack & Rationale

I chose this stack to build quickly while ensuring our injected UI stays predictable, regardless of the host site's CSS.

- **Plasmo:** Building for Manifest V3 requires significant boilerplate. Plasmo acts as our build system, handling configuration and providing reliable hot-reloading.
- **React:** Managing the lifecycle of UI components inside a Shadow DOM gets messy. React cleanly handles our state and rendering logic to keep the component tree manageable.
- **TailwindCSS:** I use Tailwind to write styles quickly. By layering custom processing logic on top, we maintain the speed of utility classes while preventing our CSS from leaking into the host page.
- **@xenova/transformers:** This is our core engine. It allows us to run machine learning models locally via WebAssembly, powering real-time offline filtering without a backend server.

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
- Navigate to the extensions page (`chrome://extensions/`).
- Toggle **Developer mode** on.
- Click **Load unpacked**.
- Select the `build/chrome-mv3-dev` directory.

To create an optimized production build, run:
```bash
npm run build
```

This generates the final bundle, ready to zip and publish.
