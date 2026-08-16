/**
 * バリアフリー簡易版のデータ型（設計書 §3.4）
 *
 * 交通局・産業労働局・福祉局が別々に公開しているデータを、住民の関心事である
 * 「車椅子で行ける場所か」という1軸に束ねる。本サービスのコンセプトを最も体現する画面。
 *
 * ■ 「なし」と断定しないこと（設計書 §3.4）
 *
 * 設備の有無は、実際には設備があるのに「なし」と表示してしまうと当事者を排除する。
 * そのため3値で持つ。
 *
 *   yes     … 元データに「ある」と明記されている
 *   no      … 元データに「ない」と**明記されている**（×）
 *   unknown … 元データが空欄。あるともないとも書かれていない
 *
 * 元データを検証したところ、局によって値の作りが違うことが分かった。
 *
 *   - 産業労働局（飲食店）… `〇` と空欄の2値。空欄は「なし」ではなく**未記入**なので、
 *     空欄は必ず unknown にする。no には決してしない
 *   - 福祉局（鉄道駅・公共施設）… `○` `×` 空欄の3値。× は明示的な「なし」なので
 *     no にしてよい。これを unknown に潰すと、当事者が必要としている
 *     「介助用ベッドは無い」という情報が消える
 *
 * つまり「空欄はすべて unknown」は共通だが、「× を no にできるか」は出典による。
 * 取り込み側で吸収し、画面はこの3値だけを見る。
 */

import type { SourceStamp } from '../source-stamp';

export type FeatureState = 'yes' | 'no' | 'unknown';

/** 絞り込みの軸。どの出典から来た場所でも同じキーで問い合わせられる */
export const FEATURE_KEYS = [
  'wheelchair_entry',
  'wheelchair_move',
  'accessible_toilet',
  'ostomate',
  'baby_changing',
  'call_button',
  'step_free',
  'elevator',
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export const FEATURE_LABEL: Record<FeatureKey, string> = {
  wheelchair_entry: '車椅子で出入りできる',
  wheelchair_move: '車椅子で中を移動できる',
  accessible_toilet: '車椅子使用者対応トイレがある',
  ostomate: 'オストメイト用設備がある',
  baby_changing: 'おむつ交換台がある',
  call_button: '非常用の呼び出しボタンがある',
  step_free: '段差が少ない（2cm以下・1ルート確保）',
  elevator: 'エレベーターがある',
};

/** 場所の種類 */
export type SpotCategory = 'restaurant' | 'station' | 'facility';

export const SPOT_LABEL: Record<SpotCategory, string> = {
  restaurant: '飲食店',
  station: '鉄道駅',
  facility: '公共施設',
};

export const SPOT_ICON: Record<SpotCategory, string> = {
  restaurant: '🍽️',
  station: '🚉',
  facility: '🏢',
};

export type BarrierFreeSpot = {
  /** 名称 */
  n: string;
  c: SpotCategory;
  /** 区市町村 */
  m?: string;
  /** 住所 */
  a: string;
  /** 補足（鉄道会社・路線名など） */
  sub?: string;
  tel?: string;
  url?: string;
  lat?: number;
  lon?: number;
  /** 条件ごとの状態。キーが無いものは unknown 扱い */
  f: Partial<Record<FeatureKey, FeatureState>>;
  /** 出典局。3局に分かれていたことを画面で見せるために持つ */
  org: string;
  s: string;
};

export type BarrierFreeDataset = {
  generatedAt: string;
  sources: SourceStamp[];
  /** 出典局ごとの件数。「分断されていた」ことを数字で見せる */
  byOrg: { org: string; label: string; count: number }[];
  spots: BarrierFreeSpot[];
};
