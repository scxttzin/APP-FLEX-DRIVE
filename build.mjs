/* ============================================================
   BUILD OPCIONAL — empacota e ofusca o app para publicação.
   ------------------------------------------------------------
   O que faz:
   1. Junta todos os módulos de js/ num único arquivo (esbuild, minificado).
   2. Ofusca esse arquivo (javascript-obfuscator) — nomes sem sentido,
      textos codificados, fluxo embaralhado.
   3. Monta a pasta dist/ com index.html apontando para o bundle ofuscado.
      A pasta js/ (código-fonte legível) NÃO vai para o dist.

   Uso local:  npm install && npm run build   (gera dist/)
   No CI:      .github/workflows/deploy-obfuscated.yml (manual)

   OBS.: ofuscação dificulta a leitura, mas NÃO impede a cópia — o código
   roda no navegador e sempre pode ser lido/reconstruído por quem insistir.
   A proteção real dos dados é o RLS do Supabase (server-side).
   ============================================================ */
import { build } from 'esbuild';
import { readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises';

// Imports por URL (CDN) continuam sendo carregados em runtime — não entram no bundle.
const CDN_EXTERNALS = [
  'https://esm.sh/@supabase/supabase-js@2',
  'https://esm.sh/qrcode-generator@1.4.4',
];

await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });

// 1) Bundle de todos os módulos locais
const result = await build({
  entryPoints: ['js/app.js'],
  bundle: true,
  format: 'esm',
  target: 'es2020',
  minify: true,
  legalComments: 'none',
  external: CDN_EXTERNALS,
  write: false,
});
const bundled = result.outputFiles[0].text;

// 2) Ofuscação
const { default: Obfuscator } = await import('javascript-obfuscator');
const obfuscated = Obfuscator.obfuscate(bundled, {
  compact: true,
  target: 'browser',
  identifierNamesGenerator: 'hexadecimal',
  simplify: true,
  numbersToExpressions: true,
  transformObjectKeys: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.5,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.2,
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 0.8,
  splitStrings: true,
  splitStringsChunkLength: 8,
  selfDefending: true,
  disableConsoleOutput: true,
}).getObfuscatedCode();

await writeFile('dist/app.min.js', obfuscated, 'utf8');

// 3) Estáticos
await cp('css', 'dist/css', { recursive: true });
await cp('assets', 'dist/assets', { recursive: true });
await cp('sw.js', 'dist/sw.js');

// 4) index.html apontando para o bundle ofuscado (sem expor js/)
let html = await readFile('index.html', 'utf8');
html = html.replace(
  '<script type="module" src="js/app.js"></script>',
  '<script type="module" src="app.min.js"></script>',
);
if (!html.includes('app.min.js')) throw new Error('Falha ao reescrever o <script> do index.html');
await writeFile('dist/index.html', html, 'utf8');

console.log('✔ build ok — dist/ pronto (app.min.js ofuscado, js/ não publicado)');
