/**
 * バリアフリー情報の取り込み（ビルド時に実行）
 *
 *   npm run build:barrierfree
 *
 * 3局に分かれて公開されているデータを「車椅子で行ける場所か」の1軸に束ねる（設計書 §3.4）。
 *
 *   産業労働局 … 都内飲食店のバリアフリー情報
 *   福祉局     … 都内鉄道駅／公共施設の車椅子使用者対応トイレ（令和7年度更新版）
 *   交通局     … 都営地下鉄4線のバリアフリー設備一覧
 *
 * ■ 設計書の前提から変わった点（実データを検証して判明）
 *
 * 設計書 §3.4 は「都営4線のみ」「飲食店・地下鉄に緯度経度が無い」を前提にしているが、
 * 福祉局が令和7年度に公開した鉄道駅データは **18事業者（東京地下鉄219・JR東日本157・
 * 東急78・京王73…）を含み、緯度経度も持つ**。付録Aの未決事項「東京メトロの情報を
 * 追加できるか」はこれで解決する。ただし福祉局データに東京都交通局は含まれないため、
 * 都営4線は交通局のデータで補う。**どちらの局も単独では都内の駅を網羅していない**
 * という事実そのものが、この画面の存在理由になる。
 *
 * ■ 値の作りが局によって違う（最重要）
 *
 *   産業労働局・交通局 … `〇` と空欄の2値。空欄は未記入なので unknown。no にはしない
 *   福祉局             … `○` `×` 空欄の3値。× は明示的な「なし」なので no にできる
 *
 * 「空欄を no と読む」実装にすると、実際には設備があるのに無いと表示して当事者を排除する。
 * 逆に「× を unknown に潰す」と、当事者が必要としている確かな情報を捨てることになる。
 *
 * ■ 同じ場所が複数行に分かれている
 *
 * 福祉局のデータはトイレ1つが1行なので、1つの駅・施設が複数行になる。
 * 場所を単位にまとめ、設備は「どれか1つでも yes なら yes」で統合する。
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse } from 'csv-parse/sync';
import iconv from 'iconv-lite';

import { splitAreaName } from '../src/data/tokyo-municipalities';
import { normalizeSearchKey } from '../src/lib/text';
import type {
  BarrierFreeDataset,
  BarrierFreeSpot,
  FeatureKey,
  FeatureState,
} from '../src/lib/barrierfree/types';
import type { SourceStamp } from '../src/lib/source-stamp';

const OUT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../src/data/generated/barrierfree.json',
);

const ORG_SANGYO = '産業労働局';
const ORG_FUKUSHI = '福祉局';
const ORG_KOTSU = '交通局';

const SOURCES = {
  restaurants: {
    id: 'barrierfree:restaurants',
    label: 'バリアフリー 飲食店（産業労働局）',
    url: 'https://www.opendata.metro.tokyo.lg.jp/sangyouroudou/barrier-free-guide.csv',
  },
  stations: {
    id: 'barrierfree:stations',
    label: 'バリアフリー 鉄道駅トイレ（福祉局）',
    url: 'https://www.opendata.metro.tokyo.lg.jp/fukushi/R07/01/4_tonaitetsudoueki_barrier-free-wc.csv',
  },
  facilities: {
    id: 'barrierfree:facilities',
    label: 'バリアフリー 公共施設トイレ（福祉局）',
    url: 'https://www.opendata.metro.tokyo.lg.jp/fukushi/R07/01/3_koukyoshisetsu_barieer_free_wc.csv',
  },
  toei: [
    { line: '浅草線', url: 'https://www.opendata.metro.tokyo.lg.jp/kotsu/subway_barrierfree_asakusa.csv' },
    { line: '三田線', url: 'https://www.opendata.metro.tokyo.lg.jp/kotsu/subway_barrierfree_mita.csv' },
    { line: '新宿線', url: 'https://www.opendata.metro.tokyo.lg.jp/kotsu/subway_barrierfree_shinjyuku.csv' },
    { line: '大江戸線', url: 'https://www.opendata.metro.tokyo.lg.jp/kotsu/subway_barrierfree_oedo.csv' },
  ],
};

class BuildError extends Error {}

function decodeCsv(buf: Buffer): string {
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return buf.subarray(3).toString('utf8');
  const utf8 = buf.toString('utf8');
  return utf8.includes('�') ? iconv.decode(buf, 'cp932') : utf8;
}

async function fetchCsv(
  id: string,
  label: string,
  url: string,
): Promise<{ rows: Record<string, string>[]; stamp: SourceStamp }> {
  const res = await fetch(url, { headers: { 'user-agent': 'tokyo-kurashi-portal/0.1' } });
  if (!res.ok) throw new BuildError(`${label}: CSVを取得できません (HTTP ${res.status}) ${url}`);
  const lastModified = res.headers.get('last-modified');
  const rows = parse(decodeCsv(Buffer.from(await res.arrayBuffer())), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  }) as Record<string, string>[];
  return {
    rows,
    stamp: {
      id,
      label,
      url,
      ...(res.headers.get('etag') ? { etag: res.headers.get('etag') as string } : {}),
      ...(lastModified ? { dataUpdatedAt: new Date(lastModified).toISOString().slice(0, 10) } : {}),
    },
  };
}

/** ○ と空欄しか無い出典。空欄は「なし」ではなく未記入なので unknown */
function twoState(value: string | undefined): FeatureState {
  return value && value.trim() !== '' ? 'yes' : 'unknown';
}

/** ○ / × / 空欄 の3値を持つ出典。× は明示的な「なし」 */
function threeState(value: string | undefined): FeatureState {
  const v = (value ?? '').trim();
  if (v === '') return 'unknown';
  if (v.startsWith('×') || v.startsWith('✕') || v.startsWith('x')) return 'no';
  return 'yes';
}

/** 「（A-01）西馬込」から路線コードを外す（設計書 §3.4 の実装注意） */
function stripStationCode(name: string): { station: string; code?: string } {
  const matched = /^[（(]([^）)]+)[）)]\s*(.+)$/.exec(name.trim());
  if (matched) return { station: matched[2].trim(), code: matched[1].trim() };
  return { station: name.trim() };
}

function municipalityOf(address: string): string | undefined {
  return splitAreaName(address.replace(/^東京都/, ''))?.municipality;
}

function toNumber(value: string | undefined): number | undefined {
  const n = Number.parseFloat(value ?? '');
  return Number.isFinite(n) ? n : undefined;
}

/** 同じ場所の複数行を1つにまとめる。設備は「どれか1つでも yes なら yes」 */
function mergeFeatures(
  base: Partial<Record<FeatureKey, FeatureState>>,
  add: Partial<Record<FeatureKey, FeatureState>>,
): Partial<Record<FeatureKey, FeatureState>> {
  const merged = { ...base };
  for (const [key, state] of Object.entries(add) as [FeatureKey, FeatureState][]) {
    const current = merged[key];
    if (current === 'yes' || state === 'yes') merged[key] = 'yes';
    else if (current === 'no' || state === 'no') merged[key] = 'no';
    else merged[key] = 'unknown';
  }
  return merged;
}

async function main() {
  const sources: SourceStamp[] = [];
  const spots = new Map<string, BarrierFreeSpot>();

  const upsert = (key: string, spot: BarrierFreeSpot) => {
    const existing = spots.get(key);
    if (existing) {
      existing.f = mergeFeatures(existing.f, spot.f);
      existing.lat ??= spot.lat;
      existing.lon ??= spot.lon;
      return;
    }
    spots.set(key, spot);
  };

  // --- 産業労働局：飲食店（〇と空欄の2値） ---
  {
    const { rows, stamp } = await fetchCsv(
      SOURCES.restaurants.id,
      SOURCES.restaurants.label,
      SOURCES.restaurants.url,
    );
    sources.push(stamp);
    for (const row of rows) {
      const name = (row['店名'] ?? '').trim();
      if (!name) continue;
      const address = (row['住所'] ?? '').trim();
      upsert(`restaurant:${name}:${address}`, {
        n: name,
        c: 'restaurant',
        a: address,
        ...(municipalityOf(address) ? { m: municipalityOf(address) as string } : {}),
        ...(row['店舗電話番号']?.trim() ? { tel: row['店舗電話番号'].trim() } : {}),
        ...(row['店舗URL']?.trim() ? { url: row['店舗URL'].trim() } : {}),
        f: {
          wheelchair_entry: twoState(row['入口幅が80cm以上である']),
          step_free: twoState(row['入口の移動経路は平坦または段差が2cm以下である']),
          wheelchair_move: twoState(row['店舗内は車椅子での移動が可能である']),
          accessible_toilet: twoState(
            row['車椅子使用者対応トイレがある（施設内の他フロアを含む）またはオストメイトがある'],
          ),
        },
        org: ORG_SANGYO,
        s: normalizeSearchKey(`${name} ${address}`),
      });
    }
    console.log(`  ${ORG_SANGYO} 飲食店: ${rows.length}行`);
  }

  // --- 福祉局：鉄道駅・公共施設（○/×/空欄の3値。1トイレ1行なので場所単位にまとめる） ---
  for (const kind of ['stations', 'facilities'] as const) {
    const source = SOURCES[kind];
    const { rows, stamp } = await fetchCsv(source.id, source.label, source.url);
    sources.push(stamp);

    let used = 0;
    for (const row of rows) {
      const name = (kind === 'stations' ? row['鉄道駅名'] : row['施設名'])?.trim();
      if (!name) continue; // 完全に空の行が混ざっている
      const address = (row['市区町村・番地'] ?? '').trim();
      const operator = (row['鉄道会社名'] ?? '').trim();
      const line = (row['路線名'] ?? '').trim();
      used += 1;

      const key =
        kind === 'stations' ? `station:${operator}:${name}` : `facility:${name}:${address}`;
      upsert(key, {
        n: kind === 'stations' ? `${name}駅` : name,
        c: kind === 'stations' ? 'station' : 'facility',
        a: address,
        ...(municipalityOf(address) ? { m: municipalityOf(address) as string } : {}),
        ...(kind === 'stations' && operator ? { sub: `${operator} ${line}`.trim() } : {}),
        ...(toNumber(row['緯度']) !== undefined ? { lat: toNumber(row['緯度']) } : {}),
        ...(toNumber(row['経度']) !== undefined ? { lon: toNumber(row['経度']) } : {}),
        f: {
          // この行そのものが車椅子使用者対応トイレの情報なので、存在は yes
          accessible_toilet: 'yes',
          wheelchair_entry: threeState(row['車椅子が出入りできる（出入口の有効幅員80cm以上）']),
          wheelchair_move: threeState(row['車椅子が転回できる（直径150cm以上の円が内接できる）']),
          ostomate: threeState(row['オストメイト用設備がある']),
          baby_changing: threeState(row['乳幼児用おむつ交換台等を備えている']),
          call_button: threeState(row['非常用呼び出しボタンを設置している']),
        },
        org: ORG_FUKUSHI,
        s: normalizeSearchKey(`${name} ${address} ${operator} ${line}`),
      });
    }
    console.log(`  ${ORG_FUKUSHI} ${kind === 'stations' ? '鉄道駅' : '公共施設'}: ${rows.length}行 → 有効${used}行`);
  }

  // --- 交通局：都営地下鉄4線（記入があれば yes の2値） ---
  for (const { line, url } of SOURCES.toei) {
    const { rows, stamp } = await fetchCsv(`barrierfree:toei-${line}`, `バリアフリー 都営${line}（交通局）`, url);
    sources.push(stamp);
    for (const row of rows) {
      const raw = (row['駅名'] ?? '').trim();
      if (!raw) continue;
      const { station } = stripStationCode(raw);
      upsert(`station:東京都交通局:${station}`, {
        n: `${station}駅`,
        c: 'station',
        a: '',
        sub: `東京都交通局 都営${line}`,
        f: {
          elevator: twoState(
            `${row['エレベーター（地上～改札階）'] ?? ''}${row['エレベーター（改札階～ホーム階）'] ?? ''}`,
          ),
          step_free: twoState(row['1ルート確保（エレベーター等）']),
          accessible_toilet: twoState(row['バリアフリートイレ（車椅子使用者対応トイレ）']),
        },
        org: ORG_KOTSU,
        s: normalizeSearchKey(`${station} 東京都交通局 都営${line}`),
      });
    }
    console.log(`  ${ORG_KOTSU} 都営${line}: ${rows.length}駅`);
  }

  const list = [...spots.values()];

  // --- 検証 ---
  if (list.length < 5000) {
    throw new BuildError(`取り込めた場所が ${list.length} 件しかありません（5,000件以上を期待）`);
  }
  // 空欄を no と読んでいないことの確認。飲食店の no は0件でなければならない
  const restaurantNo = list.filter(
    (s) => s.org === ORG_SANGYO && Object.values(s.f).includes('no'),
  );
  if (restaurantNo.length > 0) {
    throw new BuildError(
      `飲食店データに「なし」と断定した項目が ${restaurantNo.length} 件あります。` +
        `産業労働局のデータは〇と空欄の2値で、空欄は未記入です。unknown にしてください`,
    );
  }

  const byOrg = [ORG_SANGYO, ORG_FUKUSHI, ORG_KOTSU].map((org) => ({
    org,
    label: `東京都${org}`,
    count: list.filter((s) => s.org === org).length,
  }));

  const dataset: BarrierFreeDataset = {
    generatedAt: new Date().toISOString().slice(0, 10),
    sources,
    byOrg,
    spots: list,
  };

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, `${JSON.stringify(dataset)}\n`, 'utf8');

  console.log(`\nバリアフリー情報を取り込みました`);
  console.log(`  ${list.length}か所 / 出典 ${sources.length}本（3局）`);
  console.log(`  ${byOrg.map((b) => `${b.org} ${b.count}件`).join(' / ')}`);
  console.log(`  座標あり: ${list.filter((s) => s.lat !== undefined).length}件`);
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
