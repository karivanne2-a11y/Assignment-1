# São Paulo Night Run

A GPU-rendered (WebGL 2 / Three.js) arcade game: ride a delivery motorbike through rainy São Paulo at night (Paulista, Consolação, Liberdade, Pinheiros…), collect glowing orders, dodge cars and buses, and beat the clock.

## Play
Open `index.html` in a browser (Chrome/Edge/Firefox). Needs internet access for Three.js from jsDelivr.

- ← → / A D: steer · ↑ / W: accelerate · ↓ / S: brake · Space: turbo (after your first delivery)

## GPU harness
The panel at the bottom right shows:
- GPU vendor/renderer (`WEBGL_debug_renderer_info`), WebGL version
- FPS, frame time, real **GPU time** (`EXT_disjoint_timer_query_webgl2`, when the browser exposes it)
- Draw calls, triangles, render resolution, and a frame-time graph
- Quality presets: Low / Medium / High / Ultra (resolution scale, bloom, shadows, rain particle count, city density)

**Benchmark:** a 20 s autopilot run that reports average FPS, 1% low, p50/p95/p99 frame times, average GPU time, draw calls and a grade (S/A/B/C/D). You can download the result as JSON.

URL options for automated runs: `?q=low|medium|high|ultra` and `?bench=<seconds>`. The result is exposed as `window.__bench` and logged to the console as `BENCH {...}`.
