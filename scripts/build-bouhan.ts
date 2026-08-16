/**
 * 町丁別犯罪認知件数の取り込み（ビルド時に実行）
 *
 *   npm run build:bouhan
 *
 * 警視庁「区市町村の町丁別、罪種別及び手口別認知件数（年累計）」CSV 1本で完結する。
 * エンコーディングは CP932。
 *
 * ■ このデータ特有の地雷
 *
 * ① `市区町丁` が「千代田区丸の内１丁目」のように1列に連結されている。
 *    最初に現れる 区/市/町/村 で切ると武蔵村山市や羽村市が壊れるため、
 *    62区市町村の一覧に長い順で前方一致させる（src/data/tokyo-municipalities.ts）。
 *
 * ② 末尾に「区部計」「多摩地区・島部計」「合計」「他県」「海外認知」「不明」といった
 *    集計行・区分外行が混ざっている。町丁として取り込むと、件数の順位で
 *    「合計」が全町丁を押しのけて1位になる。区市町村名として解釈できない行は落とす。
 *    落とした行は必ず一覧を出力して、想定外のものが混ざっていないか人が確認できるようにする。
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse } from 'csv-parse/sync';
import iconv from 'iconv-lite';

import { splitAreaName } from '../src/data/tokyo-municipalities';
import { normalizeSearchKey } from '../src/lib/text';
import type { BouhanArea, BouhanDataset, CrimeGroup } from '../src/lib/bouhan/types';

const SOURCE = {
  url: 'https://www.keishicho.metro.tokyo.lg.jp/about_mpd/jokyo_tokei/jokyo/ninchikensu.files/R6.csv',
  sourceName: '警視庁「区市町村の町丁別、罪種別及び手口別認知件数（年累計）」',
  sourcePage:
    'https://www.keishicho.metro.tokyo.lg.jp/about_mpd/jokyo_tokei/jokyo/ninchikensu.html',
  year: '令和6年',
  /**
   * 取り込めるはずの町丁数。大きく食い違ったら公開データか区市町村一覧が変わったということ。
   * CSVの全5254行から、区市町村ごとの小計62行・区分外6行などを除いた実数。
   */
  expectedAreas: 5100,
};

const AREA_COLUMN = '市区町丁';
const TOTAL_COLUMN = '総合計';

const OUT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../src/data/generated/bouhan.json',
);

class BuildError extends Error {}

function decodeCsv(buf: Buffer): { text: string; encoding: string } {
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return { text: buf.subarray(3).toString('utf8'), encoding: 'utf-8-sig' };
  }
  const utf8 = buf.toString('utf8');
  if (!utf8.includes('�')) return { text: utf8, encoding: 'utf-8' };
  return { text: iconv.decode(buf, 'cp932'), encoding: 'cp932' };
}

/**
 * ヘッダから罪種のグループを組み立てる。
 * `<グループ名>計` を合計列とし、同じ接頭辞を持つ他の列をその手口とみなす。
 * 列名を決め打ちにしないので、年次で手口が増減しても壊れない。
 */
function buildGroups(cols: string[]): CrimeGroup[] {
  const groups: CrimeGroup[] = [];
  cols.forEach((col, index) => {
    if (col === TOTAL_COLUMN || !col.endsWith('計')) return;
    const name = col.slice(0, -1);
    const methods = cols
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => c !== col && c.startsWith(name))
      .map(({ c, i }) => ({ label: c.slice(name.length), index: i }));
    groups.push({ name, totalIndex: index, methods });
  });
  return groups;
}

async function main() {
  const res = await fetch(SOURCE.url, { headers: { 'user-agent': 'tokyo-kurashi-portal/0.1' } });
  if (!res.ok) throw new BuildError(`CSVを取得できません (HTTP ${res.status}) ${SOURCE.url}`);

  const lastModified = res.headers.get('last-modified');
  const dataUpdatedAt = lastModified ? new Date(lastModified).toISOString().slice(0, 10) : undefined;
  const etag = res.headers.get('etag') ?? undefined;

  const { text, encoding } = decodeCsv(Buffer.from(await res.arrayBuffer()));
  const rows = parse(text, { columns: true, skip_empty_lines: true, trim: true }) as Record<
    string,
    string
  >[];
  if (rows.length === 0) throw new BuildError('データ行が0件です');

  const header = Object.keys(rows[0]);
  if (!header.includes(AREA_COLUMN)) throw new BuildError(`${AREA_COLUMN} 列がありません`);
  if (!header.includes(TOTAL_COLUMN)) throw new BuildError(`${TOTAL_COLUMN} 列がありません`);

  const cols = header.filter((c) => c !== AREA_COLUMN);
  const groups = buildGroups(cols);
  if (groups.length === 0) throw new BuildError('罪種のグループを検出できませんでした');

  const areas: BouhanArea[] = [];
  const excluded: string[] = [];
  /** CSV自身が持っている区市町村ごとの小計。取り込み結果の答え合わせに使う */
  const officialSubtotals = new Map<string, number>();

  for (const row of rows) {
    const areaName = row[AREA_COLUMN]?.trim();
    if (!areaName) continue;

    const split = splitAreaName(areaName);

    // 区分外行（「２３区計」「合計」「他県」）。町丁として扱うと件数の順位を壊す
    if (!split) {
      excluded.push(areaName);
      continue;
    }

    // 区市町村ごとの小計行。取り込み結果の答え合わせに使ってから落とす
    if (split.town === '計') {
      officialSubtotals.set(split.municipality, Number.parseInt(row[TOTAL_COLUMN] ?? '0', 10) || 0);
      excluded.push(areaName);
      continue;
    }

    // 町丁名が無い行は2種類ある。檜原村のように大字を持たない実在の区域と、
    // 小計行のあとに置かれた再掲の見出し。前者は残し、後者は落とす。
    // 見分けは順序で付く（再掲は必ず「○○計」より後に来る）。
    // 落とし方を間違えると、区市町村の合計が公式の小計と合わなくなって後段の検証で止まる
    if (split.town === '') {
      if (officialSubtotals.has(split.municipality)) {
        excluded.push(areaName);
        continue;
      }
    }

    areas.push({
      m: split.municipality,
      t: split.town,
      // 郡名は検索キーに入れない。住民は「西多摩郡瑞穂町長岡」ではなく「瑞穂町長岡」で探す
      s: normalizeSearchKey(`${split.municipality}${split.town}`),
      v: cols.map((c) => Number.parseInt(row[c] ?? '0', 10) || 0),
    });
  }

  // --- 検証 ---
  if (areas.length < SOURCE.expectedAreas) {
    throw new BuildError(
      `取り込めた町丁が ${areas.length} 件しかありません（${SOURCE.expectedAreas}件以上を期待）。` +
        `区市町村名の一覧が公開データと食い違っている可能性があります。除外された行: ${excluded.slice(0, 20).join(', ')}`,
    );
  }
  const totalIndex = cols.indexOf(TOTAL_COLUMN);
  const brokenTotals = areas.filter((a) => {
    const groupSum = groups.reduce((n, g) => n + a.v[g.totalIndex], 0);
    return a.v[totalIndex] !== groupSum;
  });
  if (brokenTotals.length > 0) {
    // 総合計と罪種別の合計が合わないなら列の対応がずれている
    throw new BuildError(
      `総合計と罪種別合計が一致しない町丁が ${brokenTotals.length} 件あります（例: ${brokenTotals[0].m}${brokenTotals[0].t}）。列の対応を確認してください。`,
    );
  }

  /**
   * 区市町村ごとの合計が、CSV自身の「○○計」行と一致するかを照合する。
   * 郡名の前置（西多摩郡瑞穂町…）や小計行の混入といった分割の失敗は、
   * ここで必ず数字のズレとして現れる。取りこぼしを黙って通さないための門。
   */
  const mismatches: string[] = [];
  for (const [municipality, official] of officialSubtotals) {
    const ours = areas
      .filter((a) => a.m === municipality)
      .reduce((n, a) => n + a.v[totalIndex], 0);
    if (ours !== official) mismatches.push(`${municipality}: 取り込み${ours} ≠ 公式小計${official}`);
  }
  if (mismatches.length > 0) {
    throw new BuildError(
      `区市町村の合計がCSVの小計行と一致しません（${mismatches.length}件）。町丁の取りこぼしか二重計上があります。\n    ${mismatches.slice(0, 10).join('\n    ')}`,
    );
  }

  const dataset: BouhanDataset = {
    generatedAt: new Date().toISOString().slice(0, 10),
    ...(dataUpdatedAt ? { dataUpdatedAt } : {}),
    ...(etag ? { etag } : {}),
    sourceName: SOURCE.sourceName,
    sourceUrl: SOURCE.sourcePage,
    year: SOURCE.year,
    cols,
    groups,
    areas,
  };

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, `${JSON.stringify(dataset)}\n`, 'utf8');

  console.log(`町丁別犯罪認知件数（${SOURCE.year}）を取り込みました`);
  console.log(`  ${areas.length}町丁 / ${cols.length}列 / encoding=${encoding} / 元データ更新日=${dataUpdatedAt ?? '不明'}`);
  console.log(`  罪種グループ: ${groups.map((g) => `${g.name}(手口${g.methods.length})`).join(' ')}`);
  console.log(`  集計行として除外: ${excluded.length}件 → ${excluded.join(', ')}`);
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
