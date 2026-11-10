// Convierte dist-artifact/index.html (un único archivo) en un fragmento publicable:
// sin <html>/<head>/<body>, con React cargado desde cdnjs y todo lo demás en línea.
import { readFileSync, writeFileSync } from 'node:fs';

const html = readFileSync('dist-artifact/index.html', 'utf8');
const css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
const js = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).filter((s) => s.trim()).join('\n');
if (!css || !js) throw new Error('No se han encontrado el CSS o el JS en línea en dist-artifact/index.html');

const out = `<title>RutaLibre Sport</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Manrope:wght@600;700;800&display=swap">
<style>${css}</style>
<div id="root"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
<script>${js.replace(/<\/script/g, '<\\/script')}</script>
`;
writeFileSync('dist-artifact/rutalibre-sport.html', out);
console.log(`dist-artifact/rutalibre-sport.html · ${(out.length / 1024).toFixed(0)} kB`);
