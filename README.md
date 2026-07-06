# Neoblocker

Let's be real: static blocklists are fundamentally broken. They simply cannot keep up with the sheer volume of nuanced, dynamic content out there. I built Neoblocker to solve this problem for good.

This project is a strictly offline content firewall that runs directly inside your browser. Instead of maintaining massive, constantly outdated lists of bad domains, Neoblocker runs local machine learning models to analyze page text in real time. We intercept and filter unwanted content locally before the browser even gets a chance to paint it to the screen.

## Key Features

- **Local Inference:** I built this to guarantee zero external API calls. All text analysis happens securely on the client. Your browsing data never leaves your machine.
- **Shadow DOM Isolation:** Injecting UI into arbitrary websites frequently breaks host layouts due to CSS collisions. We handle this seamlessly by rendering the extension UI securely inside a Shadow DOM using React's `createPortal`.
- **Dynamic CSS Scoping:** Host websites are completely unpredictable. To maintain consistent styling across the web, we transform Tailwind CSS on the fly. We replace `:root` selectors with `:host(plasmo-csui)` and explicitly convert `rem` units to `px` based on a strict 16px baseline.

## Tech Stack & Rationale

I chose this specific stack to move incredibly fast while ensuring our injected UI stays robust and predictable, regardless of what CSS the host site throws at us.

- **Plasmo:** Building for Manifest V3 requires massive amounts of boilerplate. Plasmo acts as our foundational build system, stripping out configuration headaches and giving us reliable hot-reloading straight out of the box.
- **React:** Managing the complex lifecycle of UI components isolated within a Shadow DOM gets messy fast. React cleanly handles our state and rendering logic, keeping the component tree manageable.
- **TailwindCSS:** I use Tailwind to move fast on styling. By layering custom processing logic on top of it, we keep the speed of utility classes while actively preventing our CSS from leaking into the host page.
- **@xenova/transformers:** This package is our core engine. It lets us run machine learning models locally via WebAssembly, powering real-time filtering completely offline without needing any backend server.

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