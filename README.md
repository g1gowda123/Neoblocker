# Neoblocker

Hey everyone! This is a small browser extension I've been hacking on. It's basically an intelligent content firewall that uses AI to analyze text and filter things out. It's built using the Plasmo framework, React, and TailwindCSS.

## How to run it

If you want to run this locally or mess around with the code, here's what you need to do:

1. Install all the packages:
```bash
npm install
```

2. Start the dev server:
```bash
npm run dev
```

After it starts, you can load the extension into your browser. If you're on Chrome, just go to your extensions page, turn on Developer mode, click "Load unpacked", and select the `build/chrome-mv3-dev` folder.

## Production build

To create a production build, just run:
```bash
npm run build
```
This gives you the final, optimized files you can zip up and publish.

## Disclosure

Just to be completely transparent: I used some AI tools to help build this extension. A big shoutout to **google antigravity** and **jules** for helping me write code, solve bugs, and even draft this readme!
