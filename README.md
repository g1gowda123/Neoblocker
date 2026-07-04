# Neoblocker

I built Neoblocker to solve a practical problem: static blocklists fail at catching nuanced, dynamic content on the modern web.

This project is a strictly offline content firewall that runs directly inside the browser. Rather than maintaining massive, constantly outdated lists of bad domains, we run local machine learning models to analyze page text in real time. We catch and filter unwanted content locally before the browser even has a chance to paint it to the screen.

## Key Features

- **Local Inference:** All text analysis happens entirely on the client. I designed it this way to guarantee zero external API calls. Your browsing data never leaves your local machine.
- **Shadow DOM Isolation:** Injecting UI into arbitrary websites frequently breaks layouts due to CSS collisions. We handle this by rendering the extension UI securely inside a Shadow DOM using React's `createPortal`.
- **Dynamic CSS Scoping:** Host websites are inherently unpredictable. To maintain consistent styling across the web, we transform Tailwind CSS on the fly by replacing `:root` selectors with `:host(plasmo-csui)` and explicitly converting `rem` units to `px` using a strict 16px baseline.

## Tech Stack & Rationale

I chose this specific stack to keep the extension development fast, while ensuring the injected UI stays robust regardless of the host site's native CSS.

- **Plasmo:** Building for Manifest V3 requires significant boilerplate. Plasmo serves as our foundational build system, stripping out configuration overhead and providing reliable hot-reloading.
- **React:** Managing the complex lifecycle of UI components isolated within a Shadow DOM can get messy quickly. React cleanly handles the state and rendering logic to keep the component tree manageable.
- **Tailwind CSS:** I use Tailwind to move fast on styling. By layering custom processing logic on top of it, we keep the speed of utility classes while actively preventing CSS from leaking into the host page.
- **@xenova/transformers:** This package serves as our core engine. It allows us to run machine learning models locally via WebAssembly, powering the real-time filtering completely offline without the need for a backend server.

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

Once the development server is running, load the unpacked extension into your browser. For Chrome:
- Navigate to the extensions page (`chrome://extensions/`).
- Toggle **Developer mode** on.
- Click **Load unpacked**.
- Select the `build/chrome-mv3-dev` directory.

To create an optimized production build, run:
```bash
npm run build
```

This generates the final bundle ready to zip and publish.
