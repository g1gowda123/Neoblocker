# Neoblocker

I built Neoblocker to solve a specific problem: static content filters are dumb. They miss the context of what you're reading. I designed this extension as an offline, intelligent firewall that runs directly inside your browser. It uses local machine learning to analyze DOM text in real-time and dynamically strip out toxic content, hate speech, bias, and clickbait before it hits your screen.

## Key Features

- **Local Inference:** All text classification happens locally using WebAssembly. I specifically built it this way so zero external API calls are made—your browsing data stays completely on your machine.
- **Shadow DOM Isolation:** The UI is injected into the host page but rendered securely inside a Shadow DOM via React's `createPortal`. This guarantees that our extension's CSS doesn't leak out and host page styles don't unexpectedly overwrite our components.
- **Dynamic CSS Scoping:** To ensure consistent styling across arbitrary websites, the extension processes Tailwind CSS on the fly. It replaces `:root` selectors with `:host(plasmo-csui)` and converts `rem` to `px` based on a strict 16px baseline.

## Tech Stack & Rationale

I chose these tools to balance a predictable extension build process with the complexity of rendering a robust injected UI:

- **Plasmo:** The core build system. It handles the heavy boilerplate required for Manifest V3 and provides reliable hot-reloading out of the box.
- **React:** Manages state and rendering. It handles the complex lifecycles of the UI components we inject into the Shadow DOM.
- **TailwindCSS:** Speeds up the styling process. Layered with custom CSS scoping logic, it prevents conflicts with unpredictable host styles.
- **@xenova/transformers:** The logic engine. It enables us to run machine learning models locally via WebAssembly, removing the need for an external backend to process real-time text.

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
- Navigate to the extensions page.
- Toggle **Developer mode** on.
- Click **Load unpacked**.
- Select the `build/chrome-mv3-dev` directory.

To create an optimized production build, run:
```bash
npm run build
```
This generates the final bundle ready to zip and publish.
