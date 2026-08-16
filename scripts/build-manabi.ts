/**
 * 学びと体験の場（社会教育施設）の取り込み（ビルド時に実行）
 *
 *   npm run build:manabi
 *
 * 東京都教育庁「施設関連情報」。施設種別ごとに9本のCSVに分かれているが
 * **全て同一スキーマ**（区市町村名/施設区分/施設名/所在地/緯度/経度/座標系/電話番号/備考）なので、
 * 1本の取り込み処理で9本とも読める。エンコーディングは CP932、座標系は JGD2011。
 *
 * ■ このデータ特有の地雷
 *
 * ① 施設名の先頭に `＊` `＊?` `＊??` が付く。これはゴミではなく
 *    「各施設の情報掲載サイトへのリンクがある」という意味の印（各CSVの末尾に注記行がある）。
 *    表示からは取り除くが、印が付いていた事実は残す。
 * ② 名前の途中にも `?` が現れる（「日比谷図書文化館??文化財事務室」）。
 *    CP932 に変換できなかった文字が落ちた跡で、元の文字は復元できない。空白に置き換える。
 * ③ 各CSVの末尾に注記だけの行が1行ある（施設名も座標も空）。施設として取り込まない。
 * ④ **都外の施設が混ざっている。** 台東区立の少年自然の家が長野県諏訪市にあるなど、
 *    区市町村立でも都外に置かれた施設が実在する。「近くの施設」を探している住民に
 *    黙って混ぜると行けない場所を案内することになるので、都内/都外のフラグを持つ。
 * ⑤ 座標を持たない施設が1件ある（世田谷区「まちかど図書室」＝所在地が「世田谷区内5ヶ所」）。
 *    地図に出せないだけで実在するので、一覧には残す。
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse } from 'csv-parse/sync';
import iconv from 'iconv-lite';

import { TOKYO_MUNICIPALITIES, splitAreaName } from '../src/data/tokyo-municipalities';
import { normalizeSearchKey } from '../src/lib/text';
import type { ManabiDataset, ManabiFacility } from '../src/lib/manabi/types';
import type { SourceStamp } from '../src/lib/source-stamp';

const BASE = 'https://www.opendata.metro.tokyo.lg.jp/kyouiku/R3';

/** 施設種別ごとのCSV。増減があってもここに1行足すだけで済む */
const FILES = [
  'skshubetu_1', // 公民館
  'skshubetu_2', // 社会教育会館
  'skshubetu_3', // 青少年施設
  'skshubetu_4', // 図書館
  'skshubetu_5', // 博物館
  'skshubetu_6', // 博物館類似施設
  'skshubetu_7', // 女性/男女平等推進施設
  'skshubetu_8', // 生涯学習センター
  'skshubetu_9', // その他の施設
];

const SOURCE = {
  sourceName: '東京都教育庁「施設関連情報」（東京都オープンデータカタログサイト）',
  sourcePage: 'https://www.kyoiku.metro.tokyo.lg.jp/',
  fiscalYear: '令和3年度',
  /** 注記行を除いた実施設数。大きく食い違ったら公開データが変わったということ */
  expectedFacilities: 800,
};

const OUT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../src/data/generated/manabi.json',
);

class BuildError extends Error {}

function decodeCsv(buf: Buffer): string {
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return buf.subarray(3).toString('utf8');
  const utf8 = buf.toString('utf8');
  return utf8.includes('�') ? iconv.decode(buf, 'cp932') : utf8;
}

/** 先頭の＊印を落とし、文字化けして落ちた `?` を空白にする（地雷①②） */
function cleanName(raw: string): { name: string; hadLink: boolean } {
  const hadLink = /^[＊*]/.test(raw);
  const name = raw
    .replace(/^[＊*]+/, '')
    .replace(/[?？]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return { name, hadLink };
}

/**
 * 所在地から都内/都外を判定する（地雷④）。
 *
 * 単純な前方一致では檜原村の郷土資料館（所在地「西多摩郡檜原村3221」）を都外と誤判定する。
 * 町村部の住所には郡名が前置されるため、`/bouhan` と同じ splitAreaName に判定を任せる。
 * 都外の場合は先頭の都道府県名を取り出す（住所に県名が無いものもあるので任意）。
 */
function judgeLocation(address: string): { outside: boolean; pref?: string } {
  if (splitAreaName(address.replace(/^東京都/, ''))) return { outside: false };
  const pref = /^(.{2,3}?[都道府県])/.exec(address)?.[1];
  return { outside: true, ...(pref ? { pref } : {}) };
}

async function fetchCsv(name: string): Promise<{ rows: Record<string, string>[]; stamp: SourceStamp }> {
  const url = `${BASE}/${name}.csv`;
  const res = await fetch(url, { headers: { 'user-agent': 'tokyo-kurashi-portal/0.1' } });
  if (!res.ok) throw new BuildError(`${name}: CSVを取得できません (HTTP ${res.status}) ${url}`);

  const lastModified = res.headers.get('last-modified');
  const text = decodeCsv(Buffer.from(await res.arrayBuffer()));
  const rows = parse(text, { columns: true, skip_empty_lines: true, trim: true }) as Record<
    string,
    string
  >[];

  return {
    rows,
    stamp: {
      id: `manabi:${name}`,
      label: `学びの場 ${rows.find((r) => r['施設区分'])?.['施設区分'] ?? name}`,
      url,
      ...(res.headers.get('etag') ? { etag: res.headers.get('etag') as string } : {}),
      ...(lastModified ? { dataUpdatedAt: new Date(lastModified).toISOString().slice(0, 10) } : {}),
    },
  };
}

async function main() {
  const facilities: ManabiFacility[] = [];
  const sources: SourceStamp[] = [];
  let skippedNotes = 0;
  let noCoords = 0;
  const outsideList: string[] = [];

  for (const file of FILES) {
    const { rows, stamp } = await fetchCsv(file);
    sources.push(stamp);

    for (const row of rows) {
      const rawName = (row['施設名'] ?? '').trim();
      const kind = (row['施設区分'] ?? '').trim();
      // 注記だけの行（地雷③）
      if (!rawName || !kind) {
        skippedNotes += 1;
        continue;
      }

      const { name } = cleanName(rawName);
      const address = (row['所在地'] ?? '').trim();
      const lat = Number.parseFloat(row['緯度'] ?? '');
      const lon = Number.parseFloat(row['経度'] ?? '');
      const hasCoords = Number.isFinite(lat) && Number.isFinite(lon);
      if (!hasCoords) noCoords += 1;

      const location = judgeLocation(address);
      if (location.outside) outsideList.push(`${name}（${location.pref ?? '都外'}）`);

      facilities.push({
        n: name,
        k: kind,
        m: (row['区市町村名'] ?? '').trim(),
        a: address,
        ...(row['電話番号']?.trim() ? { tel: row['電話番号'].trim() } : {}),
        ...(hasCoords ? { lat, lon } : {}),
        ...(location.outside ? { outside: true as const } : {}),
        ...(location.pref ? { pref: location.pref } : {}),
        s: normalizeSearchKey(`${name} ${kind} ${row['区市町村名'] ?? ''} ${address}`),
      });
    }

    console.log(`  ${stamp.label}: ${rows.length}行 → 施設${facilities.length}件（累計）`);
  }

  // --- 検証 ---
  if (facilities.length < SOURCE.expectedFacilities) {
    throw new BuildError(
      `取り込めた施設が ${facilities.length} 件しかありません（${SOURCE.expectedFacilities}件以上を期待）`,
    );
  }
  const unknownMunicipality = facilities.filter(
    (f) => !f.outside && !TOKYO_MUNICIPALITIES.includes(f.m as (typeof TOKYO_MUNICIPALITIES)[number]),
  );
  if (unknownMunicipality.length > 0) {
    // 区市町村名が一覧に無い＝絞り込みの選択肢から漏れる。黙って通さない
    throw new BuildError(
      `区市町村名が62区市町村の一覧に無い施設が ${unknownMunicipality.length} 件あります（例: ${unknownMunicipality[0].m} / ${unknownMunicipality[0].n}）`,
    );
  }

  const kinds = [...new Set(facilities.map((f) => f.k))];
  const municipalities = TOKYO_MUNICIPALITIES.filter((m) => facilities.some((f) => f.m === m));

  const dataset: ManabiDataset = {
    generatedAt: new Date().toISOString().slice(0, 10),
    sources,
    sourceName: SOURCE.sourceName,
    sourceUrl: SOURCE.sourcePage,
    fiscalYear: SOURCE.fiscalYear,
    kinds,
    municipalities: [...municipalities],
    facilities,
  };

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, `${JSON.stringify(dataset)}\n`, 'utf8');

  console.log(`\n学びと体験の場（${SOURCE.fiscalYear}）を取り込みました`);
  console.log(`  ${facilities.length}施設 / ${kinds.length}区分 / ${municipalities.length}区市町村`);
  console.log(`  注記行として除外: ${skippedNotes}件 / 座標なし: ${noCoords}件`);
  console.log(`  都外の施設: ${outsideList.length}件 → ${outsideList.slice(0, 5).join('、')}${outsideList.length > 5 ? ' ほか' : ''}`);
  console.log(`  ${OUT_PATH} に出力しました`);
}

main().catch((err) => {
  if (err instanceof BuildError) {
    console.error(`\n✗ 取り込み中止: ${err.message}\n`);
  } else {
    console.error(err);
  }
  process.exit(1);
});
