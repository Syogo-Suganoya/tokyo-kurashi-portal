/**
 * 取り込み済みデータが最新かを確認する（取り込みはしない）
 *
 *   npm run check:data
 *
 * ■ なぜ「実行時に毎回取得する」のではなくこうするのか
 *
 * 実測すると、行政が公開するCSVの Last-Modified は月〜年の単位でしか動かない
 * （2026-08-16 時点で 立川市＝2026-01-15、中野区＝2026-07-15、警視庁＝2025-02-10）。
 * 毎リクエストで取りに行っても返ってくるのは同じ数ヶ月前のファイルであり、
 * リアルタイムにはならない。一方で失うものは大きい。
 *
 *   - 世田谷区の列ズレや檜原村の二重計上のような破損が更新で混入したとき、
 *     **ビルドで止まらず住民の画面に出る**
 *   - 都・区市町村・警視庁のサーバの障害や遅延が、そのままこちらの障害になる
 *   - 1リクエストごとに数百KBのCSVを取得・デコード・パースする
 *
 * そこで「取り込みはビルド時（検証を通してから住民に見せる）」を維持したまま、
 * 「更新されたかどうかの確認」だけを安価に切り出す。ETag による条件付きリクエストなので、
 * 更新が無ければ 304 が返るだけで本文は流れない。
 *
 * 確認対象は生成JSONの `sources` から自動で集める。簡易版やデータ源を増やしても
 * このスクリプトを書き足す必要は無い。
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { SourceStamp } from '../src/lib/source-stamp';

const GENERATED_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../src/data/generated');

/**
 * 生成物は一覧を持たずディレクトリを走査して拾う。
 * ファイル名を手で登録する作りにすると、簡易版を増やしたときに登録を忘れ、
 * 「鮮度チェックは通るのに一部のデータだけ確認されていない」という状態を作ってしまう。
 */
function collectStamps(): SourceStamp[] {
  const stamps: SourceStamp[] = [];
  const files = readdirSync(GENERATED_DIR).filter((f) => f.endsWith('.json'));
  for (const file of files) {
    const path = resolve(GENERATED_DIR, file);
    let parsed: { sources?: SourceStamp[] };
    try {
      parsed = JSON.parse(readFileSync(path, 'utf8'));
    } catch {
      console.warn(`  ⚠ ${file} が読み込めません。先に取り込みを実行してください`);
      continue;
    }
    if (!parsed.sources?.length) {
      // 足跡を持たない生成物は、鮮度を確認する手段が無いということ。黙って飛ばさない
      console.warn(`  ⚠ ${file} に sources がありません。取り込みスクリプトを確認してください`);
      continue;
    }
    stamps.push(...parsed.sources);
  }
  return stamps;
}

async function checkStamp(stamp: SourceStamp): Promise<'unchanged' | 'updated' | 'error'> {
  const headers: Record<string, string> = { 'user-agent': 'tokyo-kurashi-portal/0.1' };
  if (stamp.etag) headers['if-none-match'] = stamp.etag;

  let res: Response;
  try {
    res = await fetch(stamp.url, { headers });
  } catch (err) {
    console.warn(`  ⚠ ${stamp.label}: 確認できません（${err instanceof Error ? err.message : err}）`);
    return 'error';
  }

  if (res.status === 304) {
    console.log(`  ${stamp.label}: 更新なし（取り込み済み ${stamp.dataUpdatedAt ?? '—'}）`);
    return 'unchanged';
  }
  if (!res.ok) {
    console.warn(`  ⚠ ${stamp.label}: 確認できません (HTTP ${res.status})`);
    return 'error';
  }

  const lastModified = res.headers.get('last-modified');
  const latest = lastModified ? new Date(lastModified).toISOString().slice(0, 10) : '不明';
  if (stamp.dataUpdatedAt && latest === stamp.dataUpdatedAt) {
    console.log(`  ${stamp.label}: 更新なし（${latest}）`);
    return 'unchanged';
  }

  console.log(`  ${stamp.label}: 更新あり ${stamp.dataUpdatedAt ?? '—'} → ${latest}`);
  return 'updated';
}

async function main() {
  const stamps = collectStamps();
  if (stamps.length === 0) {
    console.error('\n✗ 確認対象がありません。npm run build:data を実行してください\n');
    process.exit(1);
  }

  console.log(`取り込み元 ${stamps.length}本の鮮度を確認します`);
  const results = await Promise.all(stamps.map(checkStamp));
  const updated = results.filter((r) => r === 'updated').length;
  const errors = results.filter((r) => r === 'error').length;

  if (updated > 0) {
    console.log(`\n${updated}本で更新を検知しました。npm run build:data で取り込み直してください。`);
    // 更新の有無で終了コードを変える。定期実行から拾えるようにするため
    process.exit(2);
  }
  if (errors > 0) {
    console.error(`\n${errors}本が確認できませんでした。`);
    process.exit(1);
  }
  console.log('\nすべて最新です。');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
