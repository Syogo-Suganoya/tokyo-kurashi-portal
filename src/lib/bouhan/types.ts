/**
 * 防犯簡易版のデータ型（設計書 §3.2）
 *
 * ■ この画面が絶対にやらないこと
 *
 * 認知件数の大小で「危ない街」と断定する表示はしない。認知件数は人口・昼間人口・
 * 繁華街の有無に強く影響され、繁華街を持つ町丁は必ず上位に来る。
 * 件数を治安の指標として見せることは、行政データの誤読を誘発する最大の減点要因になる。
 *
 * そのため型の側でも「危険度」「ランク」といった評価値は持たない。持つのは件数と、
 * その件数が何の手口で構成されているかだけ。解釈は住民に委ね、注記で誤読を防ぐ。
 */

import type { SourceStamp } from '../source-stamp';

/** 罪種のグループ（凶悪犯・粗暴犯・侵入窃盗・非侵入窃盗・その他） */
export type CrimeGroup = {
  /** グループ名（「侵入窃盗」など） */
  name: string;
  /** 合計列のインデックス */
  totalIndex: number;
  /** 手口の列（「空き巣」「忍込み」など）。ラベルはグループ名を除いたもの */
  methods: { label: string; index: number }[];
};

export type BouhanArea = {
  /** 区市町村 */
  m: string;
  /** 町丁 */
  t: string;
  /** 検索キー（区市町村＋町丁を正規化したもの） */
  s: string;
  /** 全列の値。列名は BouhanDataset.cols と同じ並び */
  v: number[];
  /**
   * 前年の総合計。
   *
   * **無いことがある。** 町丁の一覧は年によって入れ替わり、片方の年にしか無い町丁が
   * 100件以上ある。件数0の行も実在するので「載っていない＝0件」ではない。
   * そのため未定義は「前年の記録が無い」であって「前年0件」ではなく、画面も増減を出さない。
   *
   * 罪種の内訳は持たない。増減で意味があるのは総数で、手口別は件数が小さすぎて読めない。
   */
  p?: number;
};

export type BouhanDataset = {
  generatedAt: string;
  /** 取り込み元の足跡。鮮度チェック（npm run check:data）が読む */
  sources: SourceStamp[];
  /** 元データの更新日（HTTPの Last-Modified） */
  dataUpdatedAt?: string;
  sourceName: string;
  sourceUrl: string;
  /** 集計年（「令和7年」） */
  year: string;
  /** 増減の比較に使った前年（「令和6年」） */
  previousYear: string;
  /**
   * 区市町村ごとの前年の総件数。CSV自身の「○○計」行の値。
   * 町丁は年で入れ替わるため、町丁を足し上げると比較する範囲がずれる。小計行なら年をまたいでも
   * 同じ区市町村の全件を指しているので、区市町村単位の増減はこちらで出す
   */
  previousMunicipalityTotals: Record<string, number>;
  /** 列名（`市区町丁` を除く。先頭は `総合計`） */
  cols: string[];
  groups: CrimeGroup[];
  areas: BouhanArea[];
};
