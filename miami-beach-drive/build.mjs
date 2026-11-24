// Bundles src/main.js (with three.js) into single self-contained HTML files.
//   index.html                      – standalone (offline, simulated ads)
//   dist/crazygames/index.html      – loads the CrazyGames HTML5 SDK v3
//   dist/poki/index.html            – loads the Poki SDK
// VERIFY the SDK URLs below against each portal's official documentation before uploading.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const PORTALS = {
  crazygames: 'https://sdk.crazygames.com/crazygames-sdk-v3.js',
  poki: 'https://game-cdn.poki.com/scripts/v2/poki-sdk.js',
};
const result = await build({ entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'esm', target: 'es2020', write: false, legalComments: 'none' });
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const base = readFileSync('src/index.html', 'utf8').replace('/*__BUNDLE__*/', () => js);
writeFileSync('index.html', base);
console.log(`index.html (${(base.length / 1024).toFixed(0)} KB)`);
for (const [name, url] of Object.entries(PORTALS)) {
  const html = base.replace('<meta charset="utf-8">', `<meta charset="utf-8">\n<script src="${url}"></script>\n<script>window.__PORTAL = '${name}';</script>`);
  mkdirSync(`dist/${name}`, { recursive: true }); writeFileSync(`dist/${name}/index.html`, html);
  console.log(`dist/${name}/index.html`);
}
