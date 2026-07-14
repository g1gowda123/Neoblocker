# Neoblocker

I got tired of static blocklists that completely fail to keep up with the endless flood of dynamic, toxic content and clickbait on the modern web. So, I built Neoblocker: a strictly offline, machine-learning powered content firewall that runs directly inside your browser.

Instead of relying on hardcoded domains, Neoblocker intercepts and analyzes page text in real-time as you browse. By running WebAssembly models locally, we detect and block toxic content, hate speech, bias, and clickbait before the browser even paints it to your screen. No cloud APIs. No data leaving your device. Total privacy.

## Key Features

- **Local Inference:** I designed this system with a hard constraint: zero external API calls. Every piece of text analysis happens securely on your client. Your browsing data is yours, and it never touches a remote server.
- **Shadow DOM Isolation:** If you've ever built a browser extension, you know that injecting UI into arbitrary websites is a nightmare of CSS collisions. We handle this by rendering the extension UI securely inside a Shadow DOM using React's `createPortal`, guaranteeing our styles won't break the host page.
- **Dynamic CSS Scoping:** Host websites are wildly unpredictable. To maintain consistent styling for the extension, we dynamically transform our Tailwind CSS on the fly. We replace `:root` selectors with `:host(plasmo-csui)` and convert `rem` units to `px` based on a strict 16px baseline.

## Tech Stack & Rationale

I specifically chose this stack to optimize for iteration speed without sacrificing the robustness and isolation of the injected UI.

- **Plasmo:** If you're building for Manifest V3, the boilerplate is massive and painful. I use Plasmo as our build system because it abstracts away the configuration overhead and gives us out-of-the-box, reliable hot-reloading.
- **React:** Managing the lifecycle of isolated UI components inside a Shadow DOM gets messy fast. React handles our state and rendering logic cleanly, keeping the component tree predictable and maintainable.
- **TailwindCSS:** I rely on Tailwind to move quickly on styling. By adding custom processing logic on top of it, we keep the raw speed of utility classes while strictly enforcing that our CSS won't leak into the host environment.
- **@xenova/transformers:** This is the core engine that makes Neoblocker work. It allows us to execute machine learning models locally using WebAssembly. This completely eliminates the need for a backend server, powering our real-time filtering entirely offline.

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
