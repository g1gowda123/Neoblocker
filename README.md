# Neoblocker

I built Neoblocker because static blocklists fail at catching nuanced content. This is a strictly offline content firewall that runs directly in your browser. Instead of maintaining giant lists of bad domains, we run local machine learning models to analyze page text in real-time, catching and filtering unwanted content before the browser even paints it to the screen.

## Key Features

- **Local Inference:** Text analysis happens entirely on the client. I built it this way to guarantee zero external API calls, meaning your browsing data never leaves your machine.
- **Shadow DOM Isolation:** Injecting UI into arbitrary websites usually breaks things due to CSS collisions. We handle this by rendering the extension UI securely inside a Shadow DOM using React's `createPortal`.
- **Dynamic CSS Scoping:** Host websites are completely unpredictable. To maintain consistent styling across the web, we transform Tailwind CSS on the fly. We replace `:root` selectors with `:host(plasmo-csui)` and convert `rem` units to `px` based on a strict 16px baseline.

## Tech Stack & Rationale

I chose this stack to keep the extension development fast while ensuring the injected UI stays robust and predictable across any site.

- **Plasmo:** Building for Manifest V3 requires a lot of boilerplate. Plasmo acts as our foundational build system, stripping out the configuration overhead and giving us reliable hot-reloading.
- **React:** Managing the complex lifecycle of UI components isolated within a Shadow DOM can get messy fast. React handles the state and rendering logic cleanly.
- **TailwindCSS:** I use Tailwind to move fast on styling. By layering custom processing logic on top of it, we keep the speed of utility classes while actively preventing CSS leaks into the host page.
- **@xenova/transformers:** This package is the core engine. It lets us run machine learning models locally via WebAssembly, powering the real-time filtering completely offline without needing a backend server.

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
- Navigate to the extensions page (`chrome://extensions/`).
- Toggle **Developer mode** on.
- Click **Load unpacked**.
- Select the `build/chrome-mv3-dev` directory.

To create an optimized production build, run:
```bash
npm run build
```

This generates the final bundle ready to zip and publish.
