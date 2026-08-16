/**
 * バリアフリー簡易版の絞り込み（設計書 §3.4）
 *
 * UIに依存しない純関数。AI tool use の `search_barrierfree` の実体になる。
 *
 * ■ 絞り込みの意味を取り違えないこと
 *
 * 条件で絞ると、返るのは「その条件が **yes と明記されている** 場所」だけになる。
 * 絞り込みから漏れた場所は「条件を満たさない場所」ではなく、
 * 「満たすと**書かれていない**場所」であり、多くは単に未記入である。
 * この違いを画面で必ず伝える。件数を減らして見せるだけの絞り込みは、
 * 実際には入れる店を候補から消してしまう。
 */

import datasetJson from '@/data/generated/barrierfree.json';
import type { AnswerResult, Escalation, Provenance } from '@/types/answer';

import { normalizeSearchKey } from '../text';
import {
  FEATURE_KEYS,
  FEATURE_LABEL,
  SPOT_LABEL,
  type BarrierFreeDataset,
  type BarrierFreeSpot,
  type FeatureKey,
  type SpotCategory,
} from './types';

const dataset = datasetJson as BarrierFreeDataset;

export const BARRIERFREE_ORGS = dataset.byOrg;
export const BARRIERFREE_TOTAL = dataset.spots.length;

export type BarrierFreeQuery = {
  /** 満たしていてほしい条件。yes と明記されている場所だけが残る */
  features?: string[];
  category?: SpotCategory;
  municipality?: string;
  q?: string;
};

export type BarrierFreeSearchResult = AnswerResult & {
  spots: BarrierFreeSpot[];
  total: number;
  /** 条件ごとに「yesと明記」「未記入」がそれぞれ何件あるか */
  coverage: { key: FeatureKey; label: string; yes: number; unknown: number }[];
};

function provenance(): Provenance {
  return {
    sourceName: `東京都 ${dataset.byOrg.map((o) => o.org).join('・')}のオープンデータを統合`,
    sourceUrl: 'https://portal.data.metro.tokyo.lg.jp/',
    asOf: `${dataset.generatedAt} 取得（福祉局分は令和7年度更新版）`,
    coverage: `${dataset.byOrg.map((o) => `${o.org} ${o.count.toLocaleString()}件`).join(' / ')} の計${dataset.spots.length.toLocaleString()}か所`,
  };
}

/**
 * どの結果でも必ず出す2つ。非空タプルを保つため、配列の先頭に直接置いて使う
 * （スプレッドで足すと「1件以上」の保証が型から消える）。
 */
const LIMIT_FILTER_MEANING =
  '条件で絞ると、残るのは「その条件があると明記されている場所」だけです。漏れた場所は条件を満たさないのではなく、多くは元データが未記入です。';
const LIMIT_CONFIRM_BEFORE_GOING =
  '実際に入れるかどうかは、当日の状況（工事・故障・混雑）で変わります。行く前に直接ご確認ください。';

const ESCALATIONS: Escalation[] = [
  {
    kind: 'procedure',
    reason:
      '実際に入れるか、当日の状況で使えるかは、お店や施設へ直接ご確認ください。この画面から予約や問い合わせはできません。',
    linkId: 'tokyo-shien-navi',
  },
  {
    kind: 'deep_dive',
    reason:
      '宿泊・買い物・レジャーを含めて探したい場合は、都のバリアフリー情報ポータル「だれでも東京」があります。',
    linkId: 'daredemo-tokyo',
  },
];

export function searchBarrierFree(query: BarrierFreeQuery): BarrierFreeSearchResult {
  const features = (query.features ?? []).filter((f): f is FeatureKey =>
    (FEATURE_KEYS as readonly string[]).includes(f),
  );
  const key = query.q ? normalizeSearchKey(query.q) : '';

  const spots = dataset.spots.filter((spot) => {
    if (query.category && spot.c !== query.category) return false;
    if (query.municipality && spot.m !== query.municipality) return false;
    if (key && !spot.s.includes(key)) return false;
    // yes と明記されているものだけを残す。unknown を通すと「入れる」と誤って伝えることになる
    return features.every((f) => spot.f[f] === 'yes');
  });

  const coverage = FEATURE_KEYS.map((k) => ({
    key: k,
    label: FEATURE_LABEL[k],
    yes: spots.filter((s) => s.f[k] === 'yes').length,
    unknown: spots.filter((s) => s.f[k] === undefined || s.f[k] === 'unknown').length,
  }));

  const conditions = [
    query.municipality,
    // 内部キーではなく日本語のラベルを出す
    query.category ? SPOT_LABEL[query.category] : null,
    features.map((f) => FEATURE_LABEL[f]).join(' / ') || null,
    query.q ? `「${query.q}」` : null,
  ]
    .filter(Boolean)
    .join(' ・ ');


  if (spots.length === 0) {
    return {
      answer: null,
      headline: `条件に合う場所は見つかりませんでした${conditions ? `（${conditions}）` : ''}`,
      provenance: provenance(),
      limitations: [
        LIMIT_FILTER_MEANING,
        LIMIT_CONFIRM_BEFORE_GOING,
        '条件を減らすと見つかることがあります。とくに「オストメイト」「おむつ交換台」は飲食店のデータには項目自体がありません。',
      ],
      escalations: ESCALATIONS as [Escalation, ...Escalation[]],
      spots: [],
      total: dataset.spots.length,
      coverage,
    };
  }

  const byCategory = new Map<SpotCategory, number>();
  for (const s of spots) byCategory.set(s.c, (byCategory.get(s.c) ?? 0) + 1);

  return {
    answer: {
      subject: conditions || '都内すべて',
      headline: `${spots.length.toLocaleString()}か所が見つかりました`,
      icon: '♿',
      note: `内訳は ${[...byCategory.entries()].map(([c, n]) => `${SPOT_LABEL[c]} ${n.toLocaleString()}件`).join('、')} です。`,
      facts: dataset.byOrg.map((o) => ({
        label: `${o.org}のデータ`,
        value: `${spots.filter((s) => s.org === o.org).length.toLocaleString()}件`,
      })),
    },
    provenance: provenance(),
    limitations: [
      LIMIT_FILTER_MEANING,
      LIMIT_CONFIRM_BEFORE_GOING,
      '飲食店のデータには「なし」という記録がありません。〇が付いていない項目はすべて「情報なし」です。',
      '都営地下鉄以外の駅は、車椅子使用者対応トイレの情報のみで、エレベーターの有無は含まれません。',
    ],
    escalations: ESCALATIONS as [Escalation, ...Escalation[]],
    spots,
    total: dataset.spots.length,
    coverage,
  };
}
