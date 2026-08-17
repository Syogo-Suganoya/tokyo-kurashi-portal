/**
 * ごみ分別の取り込み設定を、調査結果とカタログのメタデータから組み立てる（保守用）
 *
 *   npx tsx scripts/discover-gomi-sources.ts
 *
 * `docs/gomi_taiou_jichitai.json`（全数調査の結果）に、東京都オープンデータカタログが
 * 持っている**自治体の公式ページURL**を突き合わせ、`scripts/gomi-sources.ts` に貼れる形で出力する。
 *
 * 公式ページURLを手で集めないのが要点。カタログの各データセットには、その自治体が
 * 「このデータの説明はここ」として登録した `url` がある。行政自身が登録した公式ページなので、
 * こちらで推測する必要がない。取得できたURLはこの場で疎通確認し、繋がらないものは落とす。
 *
 * 出力をそのまま採用せず、**必ず目で見てから** gomi-sources.ts に反映すること。
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SURVEY_PATH = resolve(HERE, '../docs/gomi_taiou_jichitai.json');
const CATALOG = 'https://catalog.data.metro.tokyo.lg.jp/api/3/action/package_search';

type Surveyed = {
  自治体: string;
  種別: string;
  品目数: number;
  encoding: string;
  url: string;
  列マッピング: { item: string; category: string; note?: string; kana?: string; fee?: string };
};

/** 取り込まないと決めている自治体とその理由（設計書 §2.2） */
const EXCLUDED: Record<string, string> = {
  世田谷区: '列とデータがズレている（§2.2①）。特例処理を書くまで取り込まない',
  台東区: 'カタログのCSVが404（§2.2②）',
};

/**
 * カタログ全体から、自治体ごとの「公式ページURLの候補」を集める。
 *
 * データセット単位で1件ずつ検索すると、その自治体のデータセットが上位に来ず取りこぼす。
 * ごみ関連のデータセットをまとめて取り、組織名で束ねてから候補を選ぶ。
 * 候補はごみらしいURLを優先し、繋がるものが見つかるまで順に試す。
 */
async function collectCandidates(): Promise<Map<string, string[]>> {
  const byOrg = new Map<string, string[]>();
  for (const query of ['ごみ', '分別', 'ゴミ', 'ごみ分別']) {
    for (let start = 0; start < 400; start += 100) {
      const res = await fetch(`${CATALOG}?q=${encodeURIComponent(query)}&rows=100&start=${start}`, {
        headers: { 'user-agent': 'tokyo-kurashi-portal/0.1' },
      });
      if (!res.ok) break;
      const json = (await res.json()) as {
        result: { results: { organization?: { title?: string }; url?: string }[] };
      };
      const results = json.result.results ?? [];
      if (results.length === 0) break;
      for (const pkg of results) {
        const org = pkg.organization?.title;
        if (!org || !pkg.url?.startsWith('http')) continue;
        const list = byOrg.get(org) ?? [];
        if (!list.includes(pkg.url)) list.push(pkg.url);
        byOrg.set(org, list);
      }
    }
  }
  return byOrg;
}

/**
 * ごみ関連のデータセットに公式ページURLが登録されていない自治体のための追加探索。
 * 自治体名で引き直し、その組織のデータセットに登録されたURLを候補に足す。
 * ごみのページでなくても、その自治体の公式サイト内であれば案内先として成り立つ。
 */
async function collectByMunicipality(name: string): Promise<string[]> {
  const urls: string[] = [];
  for (const query of [`${name} ごみ`, name]) {
    const res = await fetch(`${CATALOG}?q=${encodeURIComponent(query)}&rows=100`, {
      headers: { 'user-agent': 'tokyo-kurashi-portal/0.1' },
    });
    if (!res.ok) continue;
    const json = (await res.json()) as {
      result: { results: { organization?: { title?: string }; url?: string }[] };
    };
    for (const pkg of json.result.results ?? []) {
      if (pkg.organization?.title !== name || !pkg.url?.startsWith('http')) continue;
      if (!urls.includes(pkg.url)) urls.push(pkg.url);
    }
    if (urls.length > 0) break;
  }
  return urls;
}

/**
 * ごみの案内ページと確認できるURLだけを採る。
 *
 * 「その自治体のサイト内であれば何でもよい」としてはいけない。実際に候補を見たところ、
 * 千代田区は「区の花」のページ、墨田区はオープンデータの一覧ページが上位に来た。
 * ごみを調べに来た住民をそこへ送るのは、送り先が無いことよりも悪い。
 * ごみと確認できるものが無ければ、その自治体の**公式サイトのトップ**に落とす（後述）。
 */
const GOMI_PATH = /gomi|recycle|risaikuru|shigen|bunbetsu|seiso|haikibutsu|kurashi\/.*(gomi|gomi_|kankyo)/i;

function gomiPages(urls: string[]): string[] {
  return urls
    .filter((u) => GOMI_PATH.test(u.replace(/^https?:\/\/[^/]+/, '')))
    .sort((a, b) => a.length - b.length);
}

/** 候補URLから、その自治体の公式サイトのトップを作る */
function siteRoots(urls: string[]): string[] {
  const roots = new Set<string>();
  for (const u of urls) {
    try {
      roots.add(new URL(u).origin + '/');
    } catch {
      // 壊れたURLは無視する
    }
  }
  return [...roots];
}

async function reachable(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
    return res.ok;
  } catch {
    return false;
  }
}

async function main() {
  const survey = JSON.parse(readFileSync(SURVEY_PATH, 'utf8')) as { 自治体: Surveyed[] };
  const candidates = await collectCandidates();
  console.error(`カタログから ${candidates.size} 組織分の候補URLを集めました\n`);

  const rows: string[] = [];
  const skipped: string[] = [];

  for (const m of survey.自治体) {
    if (EXCLUDED[m.自治体]) {
      skipped.push(`${m.自治体}: ${EXCLUDED[m.自治体]}`);
      continue;
    }

    let pool = candidates.get(m.自治体) ?? [];
    if (pool.length === 0) pool = await collectByMunicipality(m.自治体);
    const fallback = FALLBACK_SITES[m.自治体];
    if (fallback) pool = [...pool, fallback];

    // まずごみの案内ページ。無ければ公式サイトのトップに落とす
    let page: string | null = null;
    let pageKind: 'gomi' | 'site' = 'gomi';
    for (const url of gomiPages(pool)) {
      if (await reachable(url)) {
        page = url;
        break;
      }
    }
    if (!page) {
      pageKind = 'site';
      for (const url of siteRoots(pool)) {
        if (await reachable(url)) {
          page = url;
          break;
        }
      }
    }
    if (!page) {
      skipped.push(`${m.自治体}: 繋がる公式ページ候補が無い（候補${pool.length}件）`);
      continue;
    }
    if (!(await reachable(m.url))) {
      skipped.push(`${m.自治体}: CSVに繋がらない ${m.url}`);
      continue;
    }

    const code = romaji(m.自治体);
    const cols = m.列マッピング;
    // 注意点は「注意点 → 備考 → 説明」の順で候補にする。実データで空の列があるため（§2.2④）
    const note = unique([cols.note, '注意点', '備考', '説明'].filter(Boolean) as string[]);
    const kana = cols.kana ? [cols.kana] : ['ゴミの品目_カナ', 'インデックス', 'カナ'];
    const fee = unique([cols.fee, '粗大ごみ回収料金', '料金', '料金種別'].filter(Boolean) as string[]);

    rows.push(
      `  {
    code: '${code}',
    name: '${m.自治体}',
    url: '${m.url}',
    sourceName: '${m.自治体}「ごみ分別」（東京都オープンデータカタログサイト）',
    sourcePage: '${page}',
    pageKind: '${pageKind}',
    expectedRows: ${m.品目数},
    columns: {
      item: ${JSON.stringify([cols.item])},
      category: ${JSON.stringify([cols.category])},
      note: ${JSON.stringify(note)},
      kana: ${JSON.stringify(kana)},
      fee: ${JSON.stringify(fee)},
    },
  },`,
    );
    console.error(
      `  ${pageKind === 'gomi' ? 'ごみ' : 'トップ'}  ${m.自治体.padEnd(6)} ${m.品目数.toString().padStart(5)}品目  ${page}`,
    );
  }

  console.error(`\n除外 ${skipped.length}件`);
  for (const s of skipped) console.error(`  - ${s}`);
  console.error(`\n採用 ${rows.length}自治体\n`);

  console.log('export const GOMI_SOURCES: GomiSource[] = [');
  console.log(rows.join('\n'));
  console.log('];');
}

function unique(list: string[]): string[] {
  return [...new Set(list)];
}

/**
 * カタログにURLが1件も登録されていない自治体の公式サイト。
 *
 * ここだけは自動で導けないので手で書く。ただし**綴りが合っているかはスクリプトが疎通確認する**ので、
 * 間違っていれば採用されずに除外され、黙って壊れたURLが混ざることはない。
 */
const FALLBACK_SITES: Record<string, string> = {
  調布市: 'https://www.city.chofu.lg.jp/',
  国分寺市: 'https://www.city.kokubunji.tokyo.jp/',
  文京区: 'https://www.city.bunkyo.lg.jp/',
  東村山市: 'https://www.city.higashimurayama.tokyo.jp/',
  三鷹市: 'https://www.city.mitaka.lg.jp/',
  新宿区: 'https://www.city.shinjuku.lg.jp/',
  杉並区: 'https://www.city.suginami.tokyo.jp/',
};

/** 自治体名 → 設定用のコード。既存2件と衝突しない綴りにする */
const ROMAJI: Record<string, string> = {
  千代田区: 'chiyoda', 中央区: 'chuo', 港区: 'minato', 新宿区: 'shinjuku', 文京区: 'bunkyo',
  墨田区: 'sumida', 江東区: 'koto', 品川区: 'shinagawa', 杉並区: 'suginami', 荒川区: 'arakawa',
  板橋区: 'itabashi', 葛飾区: 'katsushika', 中野区: 'nakano',
  八王子市: 'hachioji', 立川市: 'tachikawa', 武蔵野市: 'musashino', 三鷹市: 'mitaka',
  府中市: 'fuchu', 調布市: 'chofu', 小金井市: 'koganei', 日野市: 'hino', 東村山市: 'higashimurayama',
  国分寺市: 'kokubunji', 狛江市: 'komae', 東大和市: 'higashiyamato', 東久留米市: 'higashikurume',
  多摩市: 'tama', 西東京市: 'nishitokyo', 羽村市: 'hamura', 瑞穂町: 'mizuho',
};

function romaji(name: string): string {
  const code = ROMAJI[name];
  if (!code) throw new Error(`コード未定義: ${name}。ROMAJI に追記してください`);
  return code;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
