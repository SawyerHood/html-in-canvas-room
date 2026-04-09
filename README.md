# HTML-in-Canvas Room

A tech demo for the [HTML-in-Canvas API](https://github.com/WICG/html-in-canvas) — a Chrome extension that renders any webpage on a 3D CRT monitor inside a first-person gamer basement.

The entire page is captured as a live WebGL texture using `layoutsubtree` and `texElementImage2D`, displayed on a curved CRT screen in a Three.js scene. You can walk around the room, sit at the desk, and interact with the page natively (click, scroll, type) through CSS transform-based event forwarding.

## Features

- **Live webpage on a CRT** — any page you visit renders on the in-world monitor with barrel distortion, scanlines, and phosphor effects
- **First-person controls** — WASD movement, mouse look, pointer lock
- **Interactive** — sit at the desk to browse the web, native click/scroll events pass through to the page
- **Record player** — 5 YouTube tracks (lofi, jazz fusion, DnB, garage, house) with spinning vinyl and tonearm animation
- **Drink beer** — grab a beer, chug it, get progressively drunk (sway, blur, chromatic aberration). 3 drinks triggers a blackout sequence
- **PS1-style dithering** — ordered Bayer dither with adaptive color levels as a post-processing pass
- **Atmospheric** — rain with lightning, dust particles, animated LED strips, lava lamp, string lights, fog
- **Gamer basement** — brick walls, city panorama outside, gaming chair, bookshelf, posters, record cabinet, palm tree, and more
- **State persistence** — position, drunk level, music, and seated state persist across page navigations

## How it works

The key API is the [HTML-in-Canvas proposal](https://github.com/WICG/html-in-canvas):

1. A `<canvas>` element with the `layoutsubtree` attribute contains a wrapper `<div>` holding the page's DOM
2. `texElementImage2D()` captures the wrapper as a WebGL texture each frame
3. Three.js renders the texture on a curved screen mesh with a CRT shader
4. When seated, a CSS `matrix3d` transform on the wrapper maps native browser events to the projected screen bounds — so clicks and scrolling work natively (no synthetic events)

This requires a Chrome build with the HTML-in-Canvas flag enabled (`chrome://flags/#canvas-draw-element`).

## Prerequisites

This demo requires the HTML-in-Canvas API, which is only available in **Chrome Canary** with an experimental flag enabled:

1. Download [Chrome Canary](https://www.google.com/chrome/canary/)
2. Navigate to `chrome://flags/#canvas-draw-element`
3. Set **"Canvas Draw Element"** to **Enabled**
4. Relaunch Chrome Canary

## Setup

```bash
cd extension
npm install
cp web-ext.config.example.ts web-ext.config.ts
npm run dev
```

Load the unpacked extension in Chrome Canary (`chrome://extensions` → Developer mode → Load unpacked → select `extension/.output/chrome-mv3`), then click the extension icon on any page to activate.

## Controls

| Key | Action |
|-----|--------|
| **Click** | Lock mouse / interact |
| **WASD** | Move |
| **E** | Interact (sit, grab beer, play record) |
| **F** | Drink beer |
| **Q** | Toss beer |
| **Left/Right** | Browse records (when near record player) |
| **Escape** | Stand up |

## Tech stack

- [WXT](https://wxt.dev) — Chrome extension framework
- [Three.js](https://threejs.org) — 3D rendering
- TypeScript
- Custom GLSL shaders (CRT effect, drunk post-processing, PS1 dither)

## License

MIT
