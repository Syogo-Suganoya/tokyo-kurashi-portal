/**
 * MapLibre の Web Worker を public/ に配置する（dev / build の前に実行）
 *
 * maplibre-gl は地図データの解析を Web Worker に投げる。既定ではワーカーのURLを
 * バンドラに解決させるが、Next.js (Turbopack) 環境ではこの解決が効かず、
 * ワーカーの取得が HTML を返して失敗する。
 *
 *   Failed to load module script: The server responded with a non-JavaScript MIME type of "text/html".
 *
 * このとき地図タイルは表示されるのに **GeoJSON の点だけが永久に描かれない**（ソースに
 * データは入っているが loaded() が false のまま）という、原因の分かりにくい壊れ方をする。
 *
 * そこで配布物のワーカーをそのまま public/ に置き、`setWorkerUrl()` で明示的に指す。
 * node_modules からコピーするので、maplibre のバージョンを上げてもズレない。
 * ワーカーは `./maplibre-gl-shared.mjs` を相対で読むため、2本セットで置く必要がある。
 */

import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const distDir = dirname(require.resolve('maplibre-gl/dist/maplibre-gl.mjs'));
const outDir = resolve(process.cwd(), 'public/maplibre');

const FILES = ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs'];

mkdirSync(outDir, { recursive: true });
for (const file of FILES) {
  copyFileSync(resolve(distDir, file), resolve(outDir, file));
}
console.log(`maplibre のワーカーを public/maplibre/ に配置しました（${FILES.join(', ')}）`);
