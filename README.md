# Neoblocker

Static blocklists are a losing battle. They can't keep up with the sheer volume of dynamic content on the web. I built Neoblocker to handle filtering dynamically, right in the browser.

This is a strictly offline content firewall. Instead of downloading massive, outdated domain lists, Neoblocker runs machine learning models locally to analyze page text in real time. We intercept and block unwanted content before the browser even paints it to the screen.

## Key Features

- **Local Inference:** I built this to guarantee zero external API calls. All text analysis happens securely on the client, so your browsing data never leaves your machine.
- **Shadow DOM Isolation:** Injecting UI into arbitrary websites is a nightmare for CSS collisions. We handle this seamlessly by rendering the extension UI securely inside a Shadow DOM using React's `createPortal`.
- **Dynamic CSS Scoping:** You can't trust host website CSS. To keep our styling consistent, we transform Tailwind CSS on the fly. We swap out `:root` selectors for `:host(plasmo-csui)` and explicitly convert `rem` units to `px` against a strict 16px baseline.

## Tech Stack & Rationale

I chose this stack to move fast without sacrificing the stability of our injected UI, regardless of what CSS the host site throws at us.

- **Plasmo:** Building for Manifest V3 requires way too much boilerplate. Plasmo acts as our foundational build system. It handles the configuration overhead and gives us reliable hot-reloading straight out of the box.
- **React:** Managing the lifecycle of UI components isolated inside a Shadow DOM gets messy fast. React handles our state and rendering logic cleanly, keeping the component tree manageable.
- **TailwindCSS:** I use Tailwind to move fast on styling. By layering custom processing logic on top, we maintain the speed of utility classes while actively preventing our CSS from leaking into the host page.
- **@xenova/transformers:** This is our core engine. It lets us run machine learning models locally via WebAssembly, powering real-time filtering completely offline without touching a backend server.

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
