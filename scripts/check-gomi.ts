/**
 * 元データが更新されていないかを確認する（取り込みはしない）
 *
 *   npm run check:gomi
 *
 * ■ なぜ「実行時に毎回取得する」のではなくこうするのか
 *
 * 実測すると、区市町村が公開するごみ分別CSVの Last-Modified は月〜年の単位でしか動かない
 * （2026-08-16 時点で 立川市＝2026-01-15、中野区＝2026-07-15）。
 * つまり毎リクエストで取りに行っても、返ってくるのは同じ数ヶ月前のファイルであって
 * リアルタイムにはならない。得られる鮮度はゼロで、代わりに次を失う。
 *
 *   - 世田谷区のような列ズレが更新で混入したとき、**ビルドで止まらず住民の画面に出る**
 *   - 都・区市町村のサーバの障害や遅延が、そのままこちらの障害になる
 *   - 1リクエストごとに 400KB 超のCSVを取得・デコード・パースする
 *
 * そこで「取り込みはビルド時（検証を通してから住民に見せる）」を維持したまま、
 * 「更新されたかどうかの確認」だけを安価に切り出す。ETag / Last-Modified による
 * 条件付きリクエストなので、更新が無ければ 304 が返るだけで本文は流れない。
 * これを定期実行し、更新を検知したら npm run build:gomi して再デプロイする。
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { GOMI_SOURCES } from './gomi-sources';
import type { GomiDataset } from '../src/lib/gomi/types';

const DATA_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../src/data/generated/gomi.json',
);

async function main() {
  const dataset = JSON.parse(readFileSync(DATA_PATH, 'utf8')) as GomiDataset;
  let updated = 0;

  for (const source of GOMI_SOURCES) {
    const known = dataset.municipalities.find((m) => m.code === source.code);
    const headers: Record<string, string> = { 'user-agent': 'tokyo-kurashi-portal/0.1' };
    if (known?.etag) headers['if-none-match'] = known.etag;

    const res = await fetch(source.url, { method: 'GET', headers });

    if (res.status === 304) {
      console.log(`  ${source.name}: 更新なし（取り込み済み ${known?.dataUpdatedAt ?? '—'}）`);
      continue;
    }
    if (!res.ok) {
      console.warn(`  ⚠ ${source.name}: 確認できません (HTTP ${res.status})`);
      continue;
    }

    const lastModified = res.headers.get('last-modified');
    const latest = lastModified ? new Date(lastModified).toISOString().slice(0, 10) : '不明';
    if (known?.dataUpdatedAt && latest === known.dataUpdatedAt) {
      console.log(`  ${source.name}: 更新なし（${latest}）`);
      continue;
    }

    updated += 1;
    console.log(`  ${source.name}: 更新あり ${known?.dataUpdatedAt ?? '—'} → ${latest}`);
  }

  if (updated > 0) {
    console.log(`\n${updated}自治体で更新を検知しました。npm run build:gomi で取り込み直してください。`);
    // 更新の有無で終了コードを変える。定期実行から拾えるようにするため
    process.exit(2);
  }
  console.log('\nすべて最新です。');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
