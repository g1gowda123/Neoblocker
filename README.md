# Neoblocker

I built Neoblocker to act as an offline content firewall right inside your browser. Static blocklists miss nuance and context, so I designed this extension to run machine learning models locally via WebAssembly. It analyzes page text in real-time, catching and filtering unwanted content before it even renders on your screen.

## Key Features

- **Local Inference:** I wanted to make sure your browsing data never leaves your machine. All text analysis happens securely inside the browser with zero external API calls.
- **Shadow DOM Isolation:** I inject the extension UI securely into a Shadow DOM using React's `createPortal`. This strictly scopes the UI, preventing our CSS from leaking out or getting broken by the host page's arbitrary stylesheets.
- **Dynamic CSS Scoping:** To ensure consistent styling across highly variable host websites, I built in logic to transform Tailwind CSS on the fly. It replaces `:root` selectors with `:host(plasmo-csui)` and converts `rem` units to `px` against a fixed 16px baseline.

## Tech Stack & Rationale

I put this stack together to keep the extension architecture predictable while supporting a complex injected UI:

- **Plasmo:** I use this as the core build system. It strips away the heavy boilerplate needed for Manifest V3 generation and gives us reliable hot-reloading out of the box.
- **React:** This handles our state and rendering. Dealing with the lifecycle of injected components inside a Shadow DOM is tricky, and React gives me the robust component model needed to manage it smoothly.
- **TailwindCSS:** I reach for Tailwind to move fast on styling. By layering custom CSS processing over it, we prevent nasty style collisions between the extension and the sites it runs on.
- **@xenova/transformers:** This is the core logic engine. It lets us execute machine learning models locally through WebAssembly, entirely removing the need for a backend server to handle real-time content filtering.

## Setup & Usage

To get the project running locally, grab the code and install the dependencies:

```bash
npm install
```

Start up the development server:

```bash
npm run dev
```

With the dev server running, you can load the unpacked extension into Chrome:
- Open your extensions page.
- Toggle **Developer mode** on.
- Click **Load unpacked**.
- Point it to the generated `build/chrome-mv3-dev` directory.

When you are ready to cut a release, build the optimized production bundle:

```bash
npm run build
```

This generates the final assets required to zip and publish the extension.