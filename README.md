# Neoblocker

The web moves too fast for static blocklists. I built Neoblocker because hardcoded domain lists simply cannot keep up with the volume of dynamic content. Instead of maintaining endless lists of bad URLs, this project shifts the focus to real-time content analysis.

Neoblocker is an offline content firewall that runs entirely in your browser. It uses WebAssembly to execute machine learning models locally, analyzing page text as you browse. The extension intercepts and filters unwanted content right before the browser paints it to the screen.

## Key Features

- **Local Inference:** I designed the system to run without any external API calls. All text analysis happens directly on the client, guaranteeing that your browsing data never leaves your machine.
- **Shadow DOM Isolation:** Injecting an extension UI into random websites often breaks layouts due to CSS conflicts. We handle this by safely rendering the UI inside a Shadow DOM using React's `createPortal`.
- **Dynamic CSS Scoping:** Host environments are unpredictable. To maintain consistent styling without polluting the host page, we transform Tailwind CSS at runtime. The build step replaces `:root` selectors with `:host(plasmo-csui)` and converts `rem` units to `px` against a strict 16px baseline.

## Tech Stack & Rationale

I chose these tools to keep iteration speed high while ensuring our injected components stay completely isolated, no matter how chaotic the host CSS is.

- **Plasmo:** Manifest V3 extensions require significant boilerplate. I use Plasmo as the build system because it handles the configuration overhead and provides reliable hot-reloading out of the box.
- **React:** Managing UI component lifecycles inside a Shadow DOM is tricky. React cleanly handles state and rendering logic, which keeps the component tree maintainable.
- **TailwindCSS:** Tailwind lets me style components quickly. By adding custom processing logic during the build, we get the speed of utility classes while strictly preventing our CSS from leaking into the host layout.
- **@xenova/transformers:** This is the core engine of the extension. It allows us to execute machine learning models locally via WebAssembly, powering the real-time filtering offline without needing a backend server.

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

Once the development server is running, load the unpacked extension into Chrome:
- Navigate to `chrome://extensions/`.
- Toggle **Developer mode** on.
- Click **Load unpacked**.
- Select the `build/chrome-mv3-dev` directory.

To create an optimized production build, run:
```bash
npm run build
```

This generates the final bundle, ready to zip and publish.