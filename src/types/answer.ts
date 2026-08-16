/**
 * 共通画面契約（設計書 §3）
 *
 * 簡易版が返す答えは、必ずこの4点セットで返す。
 *
 *   ① 答え                          answer
 *   ② 出典・時点・カバー範囲          provenance
 *   ③ この簡易版でできないこと         limitations
 *   ④ 公式サービスへの引き継ぎ         escalations
 *
 * ②〜④は任意項目にしない。limitations / escalations を非空タプルにしてあるので、
 * 「限界を書き忘れた画面」「出口の無い画面」はコンパイルエラーになって存在し得ない。
 * 行政情報を扱うサービスとして、これが設計の核心（設計書 §3, §4.2）。
 */

import type { LinkId } from '@/data/links';

/** 少なくとも1要素を要求する配列。空配列を型で禁止するために使う */
export type NonEmpty<T> = readonly [T, ...T[]];

/** エスカレーションの4類型（設計書 §5） */
export type EscalationKind =
  /** 範囲外：未対応の自治体・路線・施設種別 */
  | 'out_of_scope'
  /** 鮮度：データの時点が古い可能性 */
  | 'freshness'
  /** 手続き：申請・予約・相談が必要。簡易版では絶対に代行しない */
  | 'procedure'
  /** 深掘り：より詳細・地図・リアルタイム情報 */
  | 'deep_dive';

export const ESCALATION_LABEL: Record<EscalationKind, string> = {
  out_of_scope: '範囲外',
  freshness: '鮮度',
  procedure: '手続き',
  deep_dive: '深掘り',
};

export type Escalation = {
  kind: EscalationKind;
  /** なぜ公式へ送るのかを住民に見せる文言。「逃げ」ではなく設計された引き継ぎであることを画面で示す */
  reason: string;
  /** キュレーションDBに実在するIDのみ。URLを直接書く経路は用意しない（設計書 §4.2） */
  linkId: LinkId;
};

/** ② 出典・時点・カバー範囲。カバー範囲を偽らないための必須項目 */
export type Provenance = {
  sourceName: string;
  sourceUrl: string;
  /** データの時点。分からない場合は「取得日」を正直に書く */
  asOf: string;
  /** どこまで対応しているか。「30自治体中2自治体」のように実数で書く */
  coverage: string;
};

export type AnswerFact = {
  label: string;
  value: string;
};

/** ① 答え本体 */
export type AnswerBody = {
  /** 何についての答えか（例：「アイロン台」） */
  subject: string;
  /**
   * 結論。**自治体の公式表記をそのまま入れる**（例：「陶器・ガラス・金属ごみ」）。
   * 勝手に「不燃ごみ」等へ正規化すると、実際のごみ袋やカレンダーの表記と食い違う（設計書 §2.2③）
   */
  headline: string;
  /** アイコン表示・横断検索のための内部キー。住民への表示には使わない */
  icon: string;
  /** 注意点など、公式データに含まれる補足文 */
  note?: string;
  /** 料金など、付随する事実 */
  facts: AnswerFact[];
};

/**
 * 簡易版4本すべてがこの型を返し、AnswerCard コンポーネント1つで描画される。
 * 個別に作り込まないことで実装量を抑える（設計書 §3）。
 */
export type AnswerCard = {
  answer: AnswerBody;
  provenance: Provenance;
  /** ③ この簡易版でできないこと。最低1件は必ず書く */
  limitations: NonEmpty<string>;
  /** ④ 出口。答えられた場合でも必ず1件は用意する */
  escalations: NonEmpty<Escalation>;
};

/** 答えを返せなかった場合。この場合も②〜④の契約は同じく満たす */
export type NoAnswerCard = {
  answer: null;
  /** 答えられなかった理由を住民に見せる */
  headline: string;
  provenance: Provenance;
  limitations: NonEmpty<string>;
  escalations: NonEmpty<Escalation>;
};

export type AnswerResult = AnswerCard | NoAnswerCard;
