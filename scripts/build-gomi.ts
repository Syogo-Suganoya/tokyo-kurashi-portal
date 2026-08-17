/**
 * ごみ分別オープンデータの取り込み（ビルド時に実行）
 *
 *   CSV取得 → エンコーディング判定 → 列解決 → 正規化キー付与 → 検索キー生成 → 静的JSON出力
 *
 * 実行時に都や区市町村のサーバを叩かない（設計書 §7）。
 * 都側の障害・遅延がデモに影響しないこと、Vercelのビルドが外部サイトに依存しないことが目的なので、
 * 生成物 src/data/generated/gomi.json はコミットする。
 *
 *   npm run build:gomi
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse } from 'csv-parse/sync';
import iconv from 'iconv-lite';

import { GOMI_SOURCES, type GomiSource } from './gomi-sources';
import { classifyCategory, normalizeSearchKey } from '../src/lib/gomi/normalize';
import type { GomiDataset, GomiItem, GomiMunicipality } from '../src/lib/gomi/types';

const OUT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../src/data/generated/gomi.json',
);

/**
 * 分別区分の異なり数が行数に対して多すぎる場合、列とデータがズレていると判断する。
 *
 * 世田谷区のCSVで実在する事故（設計書 §2.2①）。ヘッダは9列なのにデータ行は7列で、
 * 品目と分別区分の中身が入れ替わっている。列名を信じて機械的にパースすると
 * 「品目＝不燃ごみ／分別区分＝アイスピック」という壊れたデータが787件生成される。
 *
 * 分別区分は本来せいぜい数十種類なので、行数に近い異なり数が出たら異常。
 * 黙って壊れたデータを出すくらいならビルドを落とす。
 */
const CATEGORY_VARIETY_LIMIT = 0.5;

class BuildError extends Error {}

/**
 * エンコーディングを判定する。自治体ごとに固定しない（設計書 §2.2④）。
 * UTF-8 BOM が19自治体、CP932 が11自治体あり、しかも将来差し替わりうる。
 */
function decodeCsv(buf: Buffer): { text: string; encoding: string } {
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return { text: buf.subarray(3).toString('utf8'), encoding: 'utf-8-sig' };
  }
  const utf8 = buf.toString('utf8');
  // U+FFFD が出るなら UTF-8 として読めていない
  if (!utf8.includes('�')) {
    return { text: utf8, encoding: 'utf-8' };
  }
  return { text: iconv.decode(buf, 'cp932'), encoding: 'cp932' };
}

/** 候補列名のうち、実際に中身が入っている最初の列を採る */
function resolveColumn(
  rows: Record<string, string>[],
  candidates: string[] | undefined,
): { column: string; filled: number } | null {
  if (!candidates) return null;
  const header = new Set(Object.keys(rows[0] ?? {}));
  for (const candidate of candidates) {
    if (!header.has(candidate)) continue;
    const filled = rows.reduce((n, row) => (row[candidate]?.trim() ? n + 1 : n), 0);
    if (filled > 0) return { column: candidate, filled };
  }
  return null;
}

/** 住民への案内先が生きているかを確認する。死んだリンクを住民に出さないための門 */
async function assertReachable(source: GomiSource): Promise<void> {
  try {
    const res = await fetch(source.sourcePage, { headers: { 'user-agent': 'Mozilla/5.0' } });
    if (!res.ok) {
      throw new BuildError(
        `${source.name}: 案内先に繋がりません (HTTP ${res.status}) ${source.sourcePage}`,
      );
    }
  } catch (err) {
    if (err instanceof BuildError) throw err;
    throw new BuildError(`${source.name}: 案内先に繋がりません ${source.sourcePage}`);
  }
}

async function buildMunicipality(source: GomiSource): Promise<GomiMunicipality> {
  await assertReachable(source);
  const res = await fetch(source.url, { headers: { 'user-agent': 'tokyo-kurashi-portal/0.1' } });
  if (!res.ok) {
    // 台東区のようにカタログのリンクが切れている自治体が実在する（設計書 §2.2②）
    throw new BuildError(`${source.name}: CSVを取得できません (HTTP ${res.status}) ${source.url}`);
  }
  const { text, encoding } = decodeCsv(Buffer.from(await res.arrayBuffer()));

  // 元データがいつ更新されたか。取得日ではなくこちらを画面に出す
  const lastModified = res.headers.get('last-modified');
  const dataUpdatedAt = lastModified ? new Date(lastModified).toISOString().slice(0, 10) : undefined;
  const etag = res.headers.get('etag') ?? undefined;

  const rows = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    // ヘッダとデータで列数が食い違うCSVを、落とさずに読み込んで後段の検証に回す
    relax_column_count: true,
  }) as Record<string, string>[];

  if (rows.length === 0) throw new BuildError(`${source.name}: データ行が0件です`);

  const itemCol = resolveColumn(rows, source.columns.item);
  const categoryCol = resolveColumn(rows, source.columns.category);
  if (!itemCol) throw new BuildError(`${source.name}: 品目列が見つかりません (候補: ${source.columns.item.join(', ')})`);
  if (!categoryCol) {
    throw new BuildError(`${source.name}: 分別区分列が見つかりません (候補: ${source.columns.category.join(', ')})`);
  }

  const noteCol = resolveColumn(rows, source.columns.note);
  const kanaCol = resolveColumn(rows, source.columns.kana);
  const feeCol = resolveColumn(rows, source.columns.fee);

  // --- 列ズレ検証 ---
  const distinctCategories = new Set(rows.map((r) => r[categoryCol.column]?.trim()).filter(Boolean));
  const variety = distinctCategories.size / rows.length;
  if (variety > CATEGORY_VARIETY_LIMIT) {
    throw new BuildError(
      `${source.name}: 分別区分の異なり数が異常です（${distinctCategories.size}種 / ${rows.length}行 = ${(variety * 100).toFixed(0)}%）。` +
        `列とデータがズレている可能性が高いため取り込みを中止します。列マッピングを確認してください。`,
    );
  }

  const items: GomiItem[] = [];
  for (const row of rows) {
    const name = row[itemCol.column]?.trim();
    const category = row[categoryCol.column]?.trim();
    if (!name || !category) continue;

    const kana = kanaCol ? row[kanaCol.column]?.trim() : '';
    const note = noteCol ? row[noteCol.column]?.trim() : '';
    const fee = feeCol ? row[feeCol.column]?.trim() : '';

    items.push({
      n: name,
      c: category,
      k: classifyCategory(category),
      ...(note ? { note } : {}),
      ...(fee ? { fee } : {}),
      s: normalizeSearchKey(`${name}${kana ? ` ${kana}` : ''}`),
    });
  }

  const kanaFilled = kanaCol ? kanaCol.filled : 0;
  console.log(
    `  ${source.name}: ${items.length}件 / 元データ更新日=${dataUpdatedAt ?? '不明'} / encoding=${encoding} / ` +
      `品目=${itemCol.column} 区分=${categoryCol.column} ` +
      `注意点=${noteCol?.column ?? '—'}(${noteCol?.filled ?? 0}件) ` +
      `カナ=${kanaCol?.column ?? '—'}(${kanaFilled}件) ` +
      `料金=${feeCol?.column ?? '—'}(${feeCol?.filled ?? 0}件) / 区分${distinctCategories.size}種`,
  );
  if (items.length !== source.expectedRows) {
    console.warn(
      `  ⚠ ${source.name}: 期待件数 ${source.expectedRows} と一致しません（実際 ${items.length}）。公開データが更新された可能性があります`,
    );
  }

  return {
    code: source.code,
    name: source.name,
    sourceName: source.sourceName,
    sourceUrl: source.sourcePage,
    pageKind: source.pageKind,
    fetchedAt: new Date().toISOString().slice(0, 10),
    ...(dataUpdatedAt ? { dataUpdatedAt } : {}),
    ...(etag ? { etag } : {}),
    // 列があっても中身が空なら false。立川市のカナ列がこれに当たる
    hasKana: kanaFilled > 0,
    hasFee: (feeCol?.filled ?? 0) > 0,
    items,
  };
}

async function main() {
  console.log(`ごみ分別データを取り込みます（${GOMI_SOURCES.length}自治体）`);
  // 29自治体を直列に取ると時間がかかりすぎるので、まとめて取りに行く
  const municipalities = await Promise.all(GOMI_SOURCES.map(buildMunicipality));

  const dataset: GomiDataset = {
    generatedAt: new Date().toISOString().slice(0, 10),
    // 鮮度チェックが読む足跡。自治体を増やせばここも自動で増える
    sources: GOMI_SOURCES.map((source) => {
      const built = municipalities.find((m) => m.code === source.code);
      return {
        id: `gomi:${source.code}`,
        label: `ごみ分別 ${source.name}`,
        url: source.url,
        ...(built?.etag ? { etag: built.etag } : {}),
        ...(built?.dataUpdatedAt ? { dataUpdatedAt: built.dataUpdatedAt } : {}),
      };
    }),
    municipalities,
  };

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, `${JSON.stringify(dataset)}\n`, 'utf8');

  const total = municipalities.reduce((n, m) => n + m.items.length, 0);
  console.log(`合計 ${total}件を ${OUT_PATH} に出力しました`);
}

main().catch((err) => {
  if (err instanceof BuildError) {
    console.error(`\n✗ 取り込み中止: ${err.message}\n`);
  } else {
    console.error(err);
  }
  process.exit(1);
});
