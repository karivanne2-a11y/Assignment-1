// Bundles src/main.js (with three.js) into a single self-contained index.html that works offline and from file://
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';

const result = await build({
  entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'esm', target: 'es2020', write: false, legalComments: 'none',
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const html = readFileSync('src/index.html', 'utf8').replace('/*__BUNDLE__*/', () => js);
writeFileSync('index.html', html);
console.log(`index.html written (${(html.length / 1024).toFixed(0)} KB)`);
