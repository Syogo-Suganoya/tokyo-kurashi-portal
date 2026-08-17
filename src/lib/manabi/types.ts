/**
 * 学びと体験の場 簡易版のデータ型（設計書 §3.3）
 *
 * 東京都教育庁が施設種別ごとに9本のCSVで公開しているものを、1レイヤーに統合する。
 * 「近くで子どもと行ける場所」を種別をまたいで一望できるようにするのが狙いで、
 * 施設種別ごとにサイトが分かれている現状に対する差分がここにある。
 */

import type { PlaceIcon } from '@/types/glyph';

import type { SourceStamp } from '../source-stamp';

export type ManabiFacility = {
  /** 施設名（先頭の＊印などを取り除いたもの） */
  n: string;
  /** 施設区分（「図書館」「博物館」など。元データの表記のまま） */
  k: string;
  /** 区市町村名 */
  m: string;
  /** 所在地 */
  a: string;
  /** 電話番号 */
  tel?: string;
  /** 緯度・経度。座標を持たない施設が実在するため任意 */
  lat?: number;
  lon?: number;
  /**
   * 東京都外にある施設かどうか。
   * 台東区立の少年自然の家が長野県諏訪市にあるなど、区市町村立でも都外の施設が実在する。
   * 「近くの施設」を探している住民に黙って混ぜると、行けない場所を案内することになる
   */
  outside?: true;
  /** 都外の場合の所在都道府県 */
  pref?: string;
  /** 検索キー */
  s: string;
};

export type ManabiDataset = {
  generatedAt: string;
  sources: SourceStamp[];
  sourceName: string;
  sourceUrl: string;
  /** 公開年次。元データに年度の記載があるので必ず画面に出す */
  fiscalYear: string;
  /** 施設区分の一覧（絞り込みの選択肢） */
  kinds: string[];
  /** 区市町村の一覧（絞り込みの選択肢） */
  municipalities: string[];
  facilities: ManabiFacility[];
};

/**
 * 施設区分ごとの図記号。区分名（キー）は元データの表記をそのまま使う。
 * 元データに未知の区分が現れても落ちないよう、既定の目印を持つ
 */
export const MANABI_ICON: Record<string, PlaceIcon> = {
  図書館: 'library',
  博物館: 'museum',
  博物館類似施設: 'gallery',
  公民館: 'community_hall',
  社会教育会館: 'hall',
  青少年施設: 'youth',
  生涯学習センター: 'learning',
  '女性/男女平等推進施設': 'equality',
  その他の施設: 'place',
};

export function manabiIcon(kind: string): PlaceIcon {
  return MANABI_ICON[kind] ?? 'place';
}
