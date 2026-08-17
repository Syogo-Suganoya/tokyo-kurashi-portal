import type { SourceStamp } from '../source-stamp';

/**
 * ごみ分別簡易版のデータ型（設計書 §3.1）
 *
 * 表示と内部処理を分離する二層構造（設計書 §2.2③）。
 *   - 住民に見せるラベル  … `category`（自治体の公式表記そのまま）
 *   - 内部の正規化キー    … `key`（アイコン表示・横断検索にのみ使う）
 */

/**
 * 分別区分の正規化キー。
 *
 * 設計書 §2.2③ は5キー（burnable / non_burnable / oversized / recyclable / not_collected）
 * を挙げているが、実データを検証した結果2つ足りないことが判明したため7キーに拡張した。
 *
 *   - `hazardous`   … 「有害ごみ」「スプレー缶」「乾電池」「使用済蛍光管」。
 *                     non_burnable に混ぜると住民が危険な出し方をする
 *   - `drop_off`    … 「使用済小型家電（拠点回収）」「食用油（拠点回収）」。
 *                     区は収集しないが拠点に持ち込めば受け付ける。
 *                     not_collected（どこにも出せない）と同一視すると誤情報になる
 *
 * 表示は常に公式表記なので、キーが増えても住民への見え方は変わらない。
 */
export type GomiCategoryKey =
  | 'burnable'
  | 'non_burnable'
  | 'recyclable'
  | 'oversized'
  | 'hazardous'
  | 'drop_off'
  | 'not_collected'
  | 'other';

export const GOMI_CATEGORY_ICON: Record<GomiCategoryKey, string> = {
  burnable: '🔥',
  non_burnable: '🧱',
  recyclable: '♻️',
  oversized: '🛋️',
  hazardous: '⚠️',
  drop_off: '📦',
  not_collected: '🚫',
  other: '❓',
};

/** 正規化キーの説明。アイコンだけでは伝わらないので画面の補助に使う */
export const GOMI_CATEGORY_HINT: Record<GomiCategoryKey, string> = {
  burnable: '燃やすごみの区分です',
  non_burnable: '燃やさないごみの区分です',
  recyclable: '資源として回収される区分です',
  oversized: '粗大ごみです。事前の申込みが必要です',
  hazardous: '有害・危険物です。他のごみと混ぜずに出してください',
  drop_off: '通常の収集では出せません。拠点への持ち込みが必要です',
  not_collected: '自治体では収集していません',
  other: 'この区分は自動分類できませんでした。公式表記のとおりに出してください',
};

export type GomiItem = {
  /** 品目名（公式表記） */
  n: string;
  /** 分別区分（**自治体の公式表記そのまま**。正規化しない） */
  c: string;
  /** 正規化キー */
  k: GomiCategoryKey;
  /** 注意点 */
  note?: string;
  /** 粗大ごみ回収料金（円）。自治体によっては列そのものが存在しない */
  fee?: string;
  /** 検索用キー（品目名＋カナを正規化して連結したもの） */
  s: string;
};

export type GomiMunicipality = {
  code: string;
  name: string;
  sourceName: string;
  /** 住民向けの案内先。取り込み時に疎通確認済み */
  sourceUrl: string;
  /**
   * 案内先がごみの案内ページか、公式サイトのトップか。
   * ごみのページだと確認できないものを、ごみのページとして案内しないために持つ。
   */
  pageKind: 'gomi' | 'site';
  /** CSVを取得した日 */
  fetchedAt: string;
  /**
   * 元CSVの更新日（HTTPの Last-Modified）。住民にとって意味があるのは取得日ではなくこちら。
   * 「いつ取ってきたか」ではなく「行政がいつ更新したデータか」を画面に出す。
   * ヘッダを返さないサーバもあるため任意。
   */
  dataUpdatedAt?: string;
  /** 更新確認（npm run check:gomi）用。条件付きリクエストに使う */
  etag?: string;
  /** カナ検索が使えるか（カナ列が存在し、かつ中身が空でないか） */
  hasKana: boolean;
  /** 粗大ごみ料金を答えられるか */
  hasFee: boolean;
  items: GomiItem[];
};

export type GomiDataset = {
  generatedAt: string;
  /** 取り込み元の足跡。鮮度チェック（npm run check:data）が読む */
  sources: SourceStamp[];
  municipalities: GomiMunicipality[];
};
