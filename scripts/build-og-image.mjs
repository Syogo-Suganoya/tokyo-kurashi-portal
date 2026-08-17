/**
 * SNSやSlackに貼ったときに出る画像（OGP）と、iOSのホーム画面用アイコンを作る。
 *
 * **手元で一度だけ実行し、出来上がったPNGをコミットする。** ビルドには繋いでいない。
 *
 * `next/og` の ImageResponse で作る手もあるが、あれは日本語のフォントを実行時に
 * 用意しないと文字が全部豆腐になる。フォントを取りに行く処理をビルドに増やすと、
 * 「ビルド時に外部へ取りに行かない」という他の作りと食い違ううえ、
 * 提出当日にフォントの配信元が落ちれば画像が壊れる。
 * 画像は一度決めたら変わらないので、静的なPNGとして持つのが素直。
 *
 * ブラウザのタブに出るアイコンは `src/app/icon.svg` をそのまま使う。
 * SVGを読まないのは iOS のホーム画面だけなので、そこに出す分だけPNGにする。
 *
 * 文字はこの環境のフォント（ヒラギノ）で描かれる。作り直すときは出来上がりを目で見ること。
 *
 *   node scripts/build-og-image.mjs
 */

import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const sharp = (await import('sharp')).default;

const IMAGES = [
  { source: 'assets/opengraph-image.svg', output: 'src/app/opengraph-image.png', size: [1200, 630] },
  { source: 'assets/apple-icon.svg', output: 'src/app/apple-icon.png', size: [180, 180] },
];

for (const { source, output, size } of IMAGES) {
  // rsvg-convert はフォント解決に fontconfig を使うので、日本語がそのまま出る
  await run('rsvg-convert', [
    '--width',
    String(size[0]),
    '--height',
    String(size[1]),
    '--output',
    output,
    source,
  ]);

  // 読み直して、寸法が意図どおりか確かめる
  const meta = await sharp(await readFile(output)).metadata();
  if (meta.width !== size[0] || meta.height !== size[1]) {
    throw new Error(`${output} の寸法が違います: ${meta.width}x${meta.height}`);
  }
  console.log(`${output} (${meta.width}x${meta.height}) を書き出しました`);
}
