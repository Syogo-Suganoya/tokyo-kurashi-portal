/**
 * 学びと体験の場の絞り込み（設計書 §3.3）
 *
 * `/gomi` `/bouhan` と同じく UIに依存しない純関数。AI tool use の `search_manabi` の実体になる。
 *
 * 既存サービスは施設種別ごとにサイトが分かれているため、
 * 「近くで子どもと行ける場所」を種別をまたいで探すことができない。
 * ここは9種別を1レイヤーに統合して、種別をまたいだ絞り込みだけに振り切る。
 */

import datasetJson from '@/data/generated/manabi.json';
import type { AnswerResult, Escalation, Provenance } from '@/types/answer';

import { normalizeSearchKey } from '../text';
import type { ManabiDataset, ManabiFacility } from './types';

const dataset = datasetJson as ManabiDataset;

export type ManabiQuery = {
  /** 区市町村名。省略すると都内全域 */
  municipality?: string;
  /** 施設区分。省略すると全種別 */
  kinds?: string[];
  /** 施設名・所在地のキーワード */
  q?: string;
};

export type ManabiSearchResult = AnswerResult & {
  facilities: ManabiFacility[];
  /** 絞り込み結果のうち都外にある施設の数 */
  outsideCount: number;
  /** 絞り込み結果のうち座標を持たない施設の数（地図に出せない） */
  noCoordsCount: number;
};

export const MANABI_KINDS = dataset.kinds;
/** 画面の見出しで使う実数 */
export const MANABI_FACILITY_COUNT = dataset.facilities.length;
export const MANABI_MUNICIPALITIES = dataset.municipalities;

function provenance(): Provenance {
  return {
    sourceName: dataset.sourceName,
    sourceUrl: dataset.sourceUrl,
    asOf: `${dataset.fiscalYear}時点の情報です`,
    coverage: `都内62区市町村の社会教育施設 ${dataset.facilities.length}件（9種別）を1つにまとめています`,
  };
}

const ESCALATIONS: Escalation[] = [
  {
    kind: 'freshness',
    reason: `${dataset.fiscalYear}のデータです。開館状況や施設の新設・廃止は反映されていないため、行く前に各施設の公式サイトでご確認ください。`,
    linkId: 'tokyo-kyoiku',
  },
  {
    kind: 'procedure',
    reason: '開館時間・休館日・イベントの予約は、この画面からはできません。講座やイベントは都の生涯学習情報から探せます。',
    linkId: 'tokyo-syougai-gakushu',
  },
];

export function searchManabi(query: ManabiQuery): ManabiSearchResult {
  const key = query.q ? normalizeSearchKey(query.q) : '';
  const kinds = query.kinds?.filter((k) => dataset.kinds.includes(k)) ?? [];

  const facilities = dataset.facilities.filter((f) => {
    if (query.municipality && f.m !== query.municipality) return false;
    if (kinds.length > 0 && !kinds.includes(f.k)) return false;
    if (key && !f.s.includes(key)) return false;
    return true;
  });

  const outsideCount = facilities.filter((f) => f.outside).length;
  const noCoordsCount = facilities.filter((f) => f.lat === undefined).length;

  const conditions = [
    query.municipality,
    kinds.length > 0 ? kinds.join('・') : null,
    query.q ? `「${query.q}」` : null,
  ]
    .filter(Boolean)
    .join(' / ');

  if (facilities.length === 0) {
    return {
      answer: null,
      headline: `条件に合う施設は見つかりませんでした${conditions ? `（${conditions}）` : ''}`,
      provenance: provenance(),
      limitations: [
        'この画面が持っているのは社会教育施設（図書館・博物館・公民館など9種別）だけです。学校や民間の施設は含みません。',
        `${dataset.fiscalYear}のデータのため、その後に新しくできた施設は載っていません。`,
      ],
      escalations: ESCALATIONS as [Escalation, ...Escalation[]],
      facilities: [],
      outsideCount: 0,
      noCoordsCount: 0,
    };
  }

  const byKind = new Map<string, number>();
  for (const f of facilities) byKind.set(f.k, (byKind.get(f.k) ?? 0) + 1);

  const extraLimitations: string[] = [];
  if (outsideCount > 0) {
    // 区市町村立でも都外に置かれた施設が実在する。黙って混ぜない
    extraLimitations.push(
      `このうち${outsideCount}件は東京都外にあります（区市町村立の少年自然の家など）。一覧では「都外」と表示しています。`,
    );
  }
  if (noCoordsCount > 0) {
    extraLimitations.push(
      `このうち${noCoordsCount}件は元データに緯度経度が無いため、地図には表示されません（一覧には出ています）。`,
    );
  }

  return {
    answer: {
      subject: conditions || '都内全域・全種別',
      headline: `${facilities.length.toLocaleString()}件の施設が見つかりました`,
      icon: 'manabi',
      note:
        byKind.size > 1
          ? `内訳は ${[...byKind.entries()].map(([k, n]) => `${k} ${n}件`).join('、')} です。`
          : undefined,
      facts: [],
    },
    provenance: provenance(),
    limitations: [
      '開館時間・休館日・イベントの予約状況までは分かりません。',
      '社会教育施設のみで、学校や民間の施設は含みません。',
      ...extraLimitations,
    ],
    escalations: ESCALATIONS as [Escalation, ...Escalation[]],
    facilities,
    outsideCount,
    noCoordsCount,
  };
}
