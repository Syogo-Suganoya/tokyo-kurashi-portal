/**
 * ごみ分別簡易版の検索本体（設計書 §3.1）
 *
 * **UIに依存しない純関数**にしてある。次回 AI tool use を入れるとき、
 * `search_gomi` ツールの実体をそのままこれにできる（設計書 §4.1）。
 * LLMがやるのは「どのツールを呼ぶか」「入力文から品目名と自治体を抜き出すか」だけで、
 * 答えの本文はこの関数がオープンデータから組み立てる。LLMが分別区分を創作する経路は無い（§4.2）。
 *
 * limitations / escalations は非空タプル型（NonEmpty）で受けている。
 * 型アサーションで回避せず、必ず固定要素を先頭に置いて組み立てること。
 * ここでキャストすると「限界を書き忘れた画面」を型で防ぐ仕組みが崩れる。
 */

import datasetJson from '@/data/generated/gomi.json';
import {
  TOKYO_MUNICIPALITY_COUNT,
  findMunicipality,
  type UnsupportedMunicipality,
} from '@/data/municipalities';
import type { AnswerResult, Escalation, Provenance, VerifiedLink } from '@/types/answer';

import { normalizeSearchKey } from './normalize';
import type { GomiCategoryKey, GomiDataset, GomiItem, GomiMunicipality } from './types';

const dataset = datasetJson as GomiDataset;
const SUPPORTED_COUNT = dataset.municipalities.length;

/** 画面の見出しで使う実数。数字を手で書かず、取り込んだデータから出す */
export const GOMI_MUNICIPALITY_COUNT = SUPPORTED_COUNT;
export const GOMI_ITEM_COUNT = dataset.municipalities.reduce((n, m) => n + m.items.length, 0);

export type GomiQuery = {
  /** 品目名。「ペットボトル」「アイロン台」など */
  item: string;
  /** 自治体。コード（`tachikawa`）でも表示名（`立川市`）でもよい */
  municipality: string;
};

export type GomiAlternative = { name: string; category: string; icon: GomiCategoryKey };

export type GomiSearchResult = AnswerResult & {
  /** 同じ検索語に当たった他の品目。「アイロン」で引くと「アイロン台」も見せる */
  alternatives: GomiAlternative[];
};

const COVERAGE = `都内${TOKYO_MUNICIPALITY_COUNT}区市町村のうち${SUPPORTED_COUNT}自治体・${GOMI_ITEM_COUNT.toLocaleString()}品目に対応`;

/**
 * その自治体の案内先。取り込み時に疎通確認済みのURLをそのまま使う。
 * `pageKind` が `site` のときは、ごみのページだと確認できていないので名前を変える。
 * ごみのページでないものを「ごみの案内」として見せない。
 */
function officialLink(data: GomiMunicipality): VerifiedLink {
  return {
    org: data.name,
    name: data.pageKind === 'gomi' ? 'ごみの分け方・出し方' : '公式サイト',
    url: data.sourceUrl,
  };
}

function getDataset(code: string): GomiMunicipality | undefined {
  return dataset.municipalities.find((m) => m.code === code);
}

function provenanceOf(data: GomiMunicipality): Provenance {
  return {
    sourceName: data.sourceName,
    sourceUrl: data.sourceUrl,
    // 住民にとって意味があるのは「いつ取ってきたか」ではなく「行政がいつ更新したデータか」。
    // Last-Modified が取れていればそれを主に出し、取得日は補足に回す
    asOf: data.dataUpdatedAt
      ? `${data.dataUpdatedAt} 更新のデータです（${data.fetchedAt} 取得）`
      : `${data.fetchedAt} 取得（元データの更新日は公開されていません）`,
    coverage: COVERAGE,
  };
}

/** 対応していない自治体向けの出典。答えを持っていないことを、持っていないと書く */
function catalogProvenance(): Provenance {
  return {
    sourceName: '東京都オープンデータカタログサイト',
    sourceUrl: 'https://portal.data.metro.tokyo.lg.jp/',
    asOf: `${dataset.generatedAt} 時点の調査`,
    coverage: COVERAGE,
  };
}

/**
 * 品目名の一致度で並べる。
 *
 * 部分一致は必須。立川市でペットボトルを引くと公式の品目名は
 * 「飲料容器（ペットボトル）」であり、完全一致では0件になる。
 */
function rank(item: GomiItem, key: string): number {
  if (item.s === key) return 0;
  if (item.s.startsWith(key)) return 1;
  if (item.s.includes(key)) return 2;
  return Number.POSITIVE_INFINITY;
}

/**
 * 料金の見せ方。
 *
 * 元データの料金列には「500」のような金額と、「無料」「有料」という種別の2種類がある。
 * 種別に円を付けると「無料円」になる。金額が分からないことは、金額を作らずにそう書く。
 */
function feeFacts(item: GomiItem): { label: string; value: string }[] {
  if (item.fee) return [{ label: '粗大ごみ回収料金', value: `${item.fee}円` }];
  if (item.feeKind === '無料') return [{ label: '料金', value: '無料' }];
  if (item.feeKind) return [{ label: '料金', value: `${item.feeKind}（金額は公式でご確認ください）` }];
  return [];
}

export function searchGomi(query: GomiQuery): GomiSearchResult {
  const municipality = findMunicipality(query.municipality.trim());
  if (!municipality) return unknownMunicipality(query.municipality);
  if (!municipality.supported) return outOfScope(municipality);

  const data = getDataset(municipality.code);
  if (!data) {
    // 設定に自治体はあるのに取り込み済みデータが無い＝取り込み漏れ。
    // 黙って「見つかりません」と表示すると、住民には「そのごみは載っていない」と誤読される
    throw new Error(
      `取り込み済みデータに ${municipality.code} がありません。npm run build:gomi を実行してください`,
    );
  }

  const key = normalizeSearchKey(query.item);
  const hits = key
    ? data.items
        .map((item) => ({ item, score: rank(item, key) }))
        .filter((hit) => Number.isFinite(hit.score))
        .sort((a, b) => a.score - b.score || a.item.n.length - b.item.n.length)
    : [];

  if (hits.length === 0) return notFound(data, query.item);

  const best = hits[0].item;
  const alternatives: GomiAlternative[] = hits.slice(1, 6).map((hit) => ({
    name: hit.item.n,
    category: hit.item.c,
    icon: hit.item.k,
  }));

  // --- ③ できないこと ---
  const extraLimitations: string[] = [];
  if (best.k === 'oversized' && !best.fee && !data.hasFee) {
    extraLimitations.push(
      `${data.name}のオープンデータには粗大ごみの料金が含まれていないため、料金はお答えできません。`,
    );
  }
  if (best.k === 'drop_off' || best.k === 'not_collected') {
    extraLimitations.push('持ち込み先の場所や受付時間まではこの簡易版では分かりません。');
  }

  // --- ④ 出口 ---
  // 鮮度は常に発火するので先頭固定。これにより出口が0件の画面が型で作れなくなる
  const extraEscalations: Escalation[] = [];
  if (best.k === 'oversized') {
    // 手続き型。申込みという住民に責任が発生する行為は絶対に代行しない（設計書 §5）
    extraEscalations.push({
      kind: 'procedure',
      reason: `粗大ごみは事前の申込みが必要です。申込先は${data.name}の公式ページでご確認ください。この画面から申込みはできません。`,
      link: officialLink(data),
    });
  }

  return {
    answer: {
      subject: best.n,
      // 自治体の公式表記をそのまま出す。勝手に「可燃ごみ」等へ揃えると
      // 実際のごみ袋やカレンダーの表記と食い違い、住民を混乱させる（設計書 §2.2③）
      headline: best.c,
      icon: best.k,
      note: best.note,
      facts: feeFacts(best),
    },
    provenance: provenanceOf(data),
    limitations: [
      '収集日・ごみ出しの時間帯・指定袋の種類までは分かりません。',
      'この簡易版から申込みや問い合わせはできません。',
      ...extraLimitations,
    ],
    escalations: [
      {
        kind: 'freshness',
        reason: data.dataUpdatedAt
          ? `${data.dataUpdatedAt} に更新されたデータです。分別ルールは変わることがあるため、最新は公式でご確認ください。`
          : '分別ルールは変わることがあります。最新は公式でご確認ください。',
        link: officialLink(data),
      },
      ...extraEscalations,
    ],
    alternatives,
  };
}

function unknownMunicipality(input: string): GomiSearchResult {
  return {
    answer: null,
    headline: `「${input}」がどの区市町村か分かりませんでした`,
    provenance: catalogProvenance(),
    limitations: [
      '区市町村が特定できないと、ごみの分別は答えられません。分別のルールは自治体ごとに違うためです。',
    ],
    escalations: [
      {
        kind: 'out_of_scope',
        reason: 'お住まいの区市町村を選び直してください。都全体の相談先はこちらから探せます。',
        linkId: 'tokyo-shien-navi',
      },
    ],
    alternatives: [],
  };
}

function outOfScope(municipality: UnsupportedMunicipality): GomiSearchResult {
  return {
    answer: null,
    headline: `${municipality.name}はまだ対応していません`,
    provenance: catalogProvenance(),
    limitations: [
      // なぜ対応していないかを住民にそのまま見せる。「未対応」だけでは何も伝わらない
      municipality.reason,
      '対応自治体はデータが揃い次第、順次増やしていきます。',
    ],
    escalations: [
      {
        kind: 'out_of_scope',
        reason: `${municipality.name}の公式ページで、品目ごとの分別を調べられます。`,
        linkId: municipality.officialLinkId,
      },
    ],
    alternatives: [],
  };
}

function notFound(data: GomiMunicipality, item: string): GomiSearchResult {
  return {
    answer: null,
    headline: item.trim()
      ? `${data.name}のデータに「${item}」は見つかりませんでした`
      : '調べたい品目を入力してください',
    provenance: provenanceOf(data),
    limitations: [
      `この簡易版が持っているのは${data.name}が公開している${data.items.length}品目だけです。載っていない品目は答えられません。`,
      '言い換えると見つかることがあります（例：「ペットボトル」は「飲料容器（ペットボトル）」として載っています）。',
    ],
    escalations: [
      {
        kind: 'deep_dive',
        reason: `${data.name}の公式なら、ここに無い品目も調べられます。`,
        link: officialLink(data),
      },
    ],
    alternatives: [],
  };
}
