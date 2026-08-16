/**
 * 分別区分の正規化キーへの写像。
 *
 * 検索キーの正規化は簡易版をまたいで共通なので `@/lib/text` にある。
 */

import type { GomiCategoryKey } from './types';

export { normalizeSearchKey } from '../text';

/**
 * 分別区分の公式表記 → 正規化キー。
 *
 * 上から順に判定し、最初に当たったものを採用する。**順序に意味がある**。
 *
 *  - 危険物（hazardous）を拠点回収（drop_off）より先に見る。
 *    「使用済蛍光管（拠点回収）」は両方に当たるが、住民に伝えるべきは危険物であることの方
 *  - 資源（recyclable）を燃やさないごみ（non_burnable）より先に見る。
 *    「びん・缶・ペットボトル」が金属扱いに落ちるのを防ぐ
 */
const CATEGORY_RULES: ReadonlyArray<readonly [RegExp, GomiCategoryKey]> = [
  [/粗大/, 'oversized'],
  [
    /収集しない|収集できません|収集は不可|回収しません|処理できません|処理困難|受け付け(ら)?れません|家電リサイクル|パソコン|適正処理困難/,
    'not_collected',
  ],
  [/有害|乾電池|電池|蛍光|水銀|スプレー|カセットボンベ|ライター|刃物/, 'hazardous'],
  [/拠点回収|拠点|持ち込み|店頭回収|回収ボックス/, 'drop_off'],
  [
    /資源|プラスチック|ペットボトル|びん|ビン|瓶|缶|カン|古紙|雑がみ|雑誌|新聞|段ボール|ダンボール|紙パック|紙製|古布|古着|衣類|布|集団回収|牛乳|茶色紙/,
    'recyclable',
  ],
  [/燃やすごみ|燃やせるごみ|燃えるごみ|もえるごみ|可燃/, 'burnable'],
  [/燃やさない|燃やせない|燃えない|もえない|不燃|陶器|ガラス|金属/, 'non_burnable'],
];

export function classifyCategory(officialLabel: string): GomiCategoryKey {
  const label = officialLabel.normalize('NFKC');
  for (const [pattern, key] of CATEGORY_RULES) {
    if (pattern.test(label)) return key;
  }
  return 'other';
}
