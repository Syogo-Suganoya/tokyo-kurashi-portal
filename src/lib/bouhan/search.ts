/**
 * 防犯簡易版の検索本体（設計書 §3.2）
 *
 * `/gomi` と同じく UIに依存しない純関数。AI tool use の `search_bouhan` の実体になる。
 *
 * ■ 表示上の最重要方針
 *
 * 認知件数は人口・昼間人口・繁華街の有無に強く影響される。件数の大小をそのまま
 * 「危ない街」と読ませる表示は絶対に作らない（設計書 §3.2）。
 * そのため:
 *   - 「危険度」「治安ランク」のような評価値は一切作らない
 *   - アイコンは警告色ではなく中立の📊にする
 *   - 内訳の上位手口を必ず併記する。丸の内の418件が万引き・置引き中心であることが見えれば、
 *     件数の多さが「住民が襲われる街」を意味しないことは数字自体が語る
 *   - 誤読を防ぐ注記を limitations に必ず入れる（共通画面契約により省略できない）
 */

import datasetJson from '@/data/generated/bouhan.json';
import { TOKYO_MUNICIPALITIES } from '@/data/tokyo-municipalities';
import type { AnswerResult, Provenance } from '@/types/answer';

import { normalizeSearchKey } from '../text';
import type { BouhanDataset, BouhanArea } from './types';

const dataset = datasetJson as BouhanDataset;
const TOTAL_INDEX = dataset.cols.indexOf('総合計');

/** 画面の見出しで使う実数 */
export const BOUHAN_AREA_COUNT = dataset.areas.length;
export const BOUHAN_YEAR = dataset.year;

export type BouhanQuery = {
  /** 町丁名または区市町村名。「丸の内１丁目」「立川市」など */
  area: string;
};

export type BouhanBreakdown = { label: string; count: number };

export type BouhanSearchResult = AnswerResult & {
  /** 見つかった町丁（区市町村の集計の場合は null） */
  matched: { municipality: string; town: string; total: number } | null;
  /** 罪種別の内訳 */
  groups: BouhanBreakdown[];
  /** 件数の多い手口 上位5件 */
  topMethods: BouhanBreakdown[];
  /** 同じ検索語に当たった他の町丁 */
  alternatives: { name: string; total: number }[];
};

function provenance(): Provenance {
  return {
    sourceName: dataset.sourceName,
    sourceUrl: dataset.sourceUrl,
    asOf: dataset.dataUpdatedAt
      ? `${dataset.year}の年間累計（${dataset.dataUpdatedAt} 公開）`
      : `${dataset.year}の年間累計`,
    coverage: `都内${dataset.areas.length.toLocaleString()}町丁を収録（東京都全域）`,
  };
}

/** 誤読を防ぐ注記。どの検索結果でも必ず出す */
const BASE_LIMITATIONS = [
  '認知件数は人口・昼間人口・繁華街の有無に強く影響されます。件数が多いことは、その町丁が危険であることを意味しません。',
  '駅や商業施設のある町丁は、そこで働く人・訪れる人の分だけ件数が増えます。住んでいる人の被害の多さとは別のものです。',
  'この画面は件数を並べるだけで、治安の良し悪しを判定するものではありません。',
] as const;

function toBreakdowns(area: BouhanArea): { groups: BouhanBreakdown[]; topMethods: BouhanBreakdown[] } {
  const groups = dataset.groups.map((g) => ({ label: g.name, count: area.v[g.totalIndex] }));
  const topMethods = dataset.groups
    .flatMap((g) => g.methods.map((m) => ({ label: `${g.name}・${m.label}`, count: area.v[m.index] })))
    .filter((m) => m.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  return { groups, topMethods };
}

/** 区市町村内での件数の位置。順位だけだと誤読を招くので中央値も併せて返す */
function positionInMunicipality(area: BouhanArea): { rank: number; count: number; median: number } {
  const siblings = dataset.areas
    .filter((a) => a.m === area.m)
    .map((a) => a.v[TOTAL_INDEX])
    .sort((a, b) => b - a);
  const rank = siblings.findIndex((v) => v <= area.v[TOTAL_INDEX]) + 1;
  const median = siblings[Math.floor(siblings.length / 2)] ?? 0;
  return { rank, count: siblings.length, median };
}

/** 区市町村全体の集計。町丁を1つ選ばず、その区市町村の全町丁を足し上げる */
function searchMunicipality(municipality: string): BouhanSearchResult {
  const areas = dataset.areas.filter((a) => a.m === municipality);
  const summed: BouhanArea = {
    m: municipality,
    t: '',
    s: '',
    v: dataset.cols.map((_, i) => areas.reduce((n, a) => n + a.v[i], 0)),
  };
  const total = summed.v[TOTAL_INDEX];
  const { groups, topMethods } = toBreakdowns(summed);

  return {
    answer: {
      subject: `${municipality}全体（${dataset.year}）`,
      headline: `刑法犯の認知件数 ${total.toLocaleString()}件`,
      icon: '📊',
      note:
        topMethods.length > 0
          ? `件数の内訳で多いのは ${topMethods.map((m) => `${m.label} ${m.count}件`).join('、')} です。`
          : undefined,
      facts: [
        ...groups.map((g) => ({ label: g.label, value: `${g.count.toLocaleString()}件` })),
        { label: '収録している町丁数', value: `${areas.length}町丁` },
      ],
    },
    provenance: provenance(),
    limitations: [
      ...BASE_LIMITATIONS,
      '区市町村どうしの件数を直接比べても意味がありません。人口も面積も昼間人口も違うためです。',
      `${dataset.year}の1年分の累計です。前年からの増減は分かりません。`,
    ],
    escalations: [
      {
        kind: 'deep_dive',
        reason: '周辺一帯を地図で面的に見たい場合は、公式の防犯マップが使えます。',
        linkId: 'tokyo-bouhan-map',
      },
    ],
    matched: { municipality, town: '', total },
    groups,
    topMethods,
    // 町丁単位で見たい人向けに、件数の多い町丁を出口として並べる
    alternatives: [...areas]
      .sort((a, b) => b.v[TOTAL_INDEX] - a.v[TOTAL_INDEX])
      .slice(0, 5)
      .map((a) => ({ name: `${a.m}${a.t}`, total: a.v[TOTAL_INDEX] })),
  };
}

export function searchBouhan(query: BouhanQuery): BouhanSearchResult {
  const key = normalizeSearchKey(query.area);

  // 「立川市」のように区市町村名だけで引かれたら、市内の任意の1町丁ではなく市全体を集計する。
  // 町丁を1つ選んで返すと、それがその市の代表であるかのように誤読される
  const municipality = TOKYO_MUNICIPALITIES.find((m) => normalizeSearchKey(m) === key);
  if (municipality) return searchMunicipality(municipality);

  const hits = key ? dataset.areas.filter((a) => a.s.includes(key)) : [];

  if (hits.length === 0) {
    return {
      answer: null,
      headline: key
        ? `「${query.area}」に当たる町丁が見つかりませんでした`
        : '調べたい町丁名または区市町村名を入力してください',
      provenance: provenance(),
      limitations: [
        `収録しているのは${dataset.year}時点の町丁名です。町名だけ（「丸の内」）や区名を付けた形（「千代田区丸の内」）でもお試しください。`,
        ...BASE_LIMITATIONS,
      ],
      escalations: [
        {
          kind: 'deep_dive',
          reason: '地図の上で場所を指して探したい場合は、公式の防犯マップが使えます。',
          linkId: 'tokyo-bouhan-map',
        },
      ],
      matched: null,
      groups: [],
      topMethods: [],
      alternatives: [],
    };
  }

  // 完全一致 → 短い名前の順。「立川市」で引いたときに市内の代表町丁が先に来るようにする
  const sorted = [...hits].sort((a, b) => {
    const aExact = a.s === key ? 0 : 1;
    const bExact = b.s === key ? 0 : 1;
    return aExact - bExact || `${a.m}${a.t}`.length - `${b.m}${b.t}`.length;
  });
  const best = sorted[0];
  const total = best.v[TOTAL_INDEX];
  const { groups, topMethods } = toBreakdowns(best);
  const position = positionInMunicipality(best);

  const facts = [
    ...groups.map((g) => ({ label: g.label, value: `${g.count.toLocaleString()}件` })),
    {
      label: `${best.m}内での件数`,
      value: `${position.count}町丁中${position.rank}番目に多い（区市町村内の中央値は${position.median}件）`,
    },
  ];

  return {
    answer: {
      subject: `${best.m}${best.t}（${dataset.year}）`,
      headline: `刑法犯の認知件数 ${total.toLocaleString()}件`,
      // 警告のアイコンは使わない。これは治安の評価ではなく件数の表示
      icon: '📊',
      note:
        topMethods.length > 0
          ? `件数の内訳で多いのは ${topMethods.map((m) => `${m.label} ${m.count}件`).join('、')} です。何がこの件数を作っているかを見てください。`
          : undefined,
      facts,
    },
    provenance: provenance(),
    limitations: [
      ...BASE_LIMITATIONS,
      `${dataset.year}の1年分の累計です。前年からの増減や、時間帯・曜日ごとの傾向は分かりません。`,
      '町丁より細かい場所（どの通りか）や、事件の内容までは分かりません。',
    ],
    escalations: [
      {
        kind: 'deep_dive',
        reason: '周辺一帯を地図で面的に見たい場合は、公式の防犯マップが使えます。',
        linkId: 'tokyo-bouhan-map',
      },
      {
        kind: 'deep_dive',
        reason: '直近に発生した事件・事故を地図で見たい場合は、警視庁の発生マップがあります。',
        linkId: 'keishicho-hassei-map',
      },
    ],
    matched: { municipality: best.m, town: best.t, total },
    groups,
    topMethods,
    alternatives: sorted
      .slice(1, 6)
      .map((a) => ({ name: `${a.m}${a.t}`, total: a.v[TOTAL_INDEX] })),
  };
}
