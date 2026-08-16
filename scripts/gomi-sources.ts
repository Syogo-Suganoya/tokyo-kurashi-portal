/**
 * ごみ分別オープンデータの取り込み設定（ビルド時のみ使用）
 *
 * 自治体を増やす作業がここへの数行追記で済むことが、この構造の狙い（設計書 §2.2）。
 * 全30自治体の一次調査結果は docs/gomi_taiou_jichitai.json にある。
 *
 * ■ 列名は「単一の列名」ではなく「候補の配列」で持つ
 *
 * 実データを検証したところ、docs/gomi_taiou_jichitai.json の列マッピングをそのまま
 * 信じると壊れるケースが実在した。
 *
 *   - 立川市の `注意点` 列は 2,082件すべて空。実際の注意文は `備考` 列にある
 *   - 立川市の `ゴミの品目_カナ` 列も全件空。カナ検索には使えない
 *   - 中野区の `インデックス` 列は 942件すべてひらがな。カナ検索に使える（調査JSONには未記載）
 *
 * そこで候補を順に見て「最初に中身が入っていた列」を採用する。
 * 空の列を掴んで注意点が全部消える、という事故が起きない。
 */

export type GomiSource = {
  code: string;
  name: string;
  url: string;
  sourceName: string;
  /** データの出典ページ（CSVそのものではなく、住民が辿れるページ） */
  sourcePage: string;
  /** 期待件数。取り込み結果がこれと食い違ったら警告する */
  expectedRows: number;
  columns: {
    /** 品目名。必須 */
    item: string[];
    /** 分別区分。必須 */
    category: string[];
    /** 注意点。候補を順に見て最初に非空だったものを使う */
    note?: string[];
    /** カナ（読み仮名）。空列しか無ければカナ検索は無効になる */
    kana?: string[];
    /** 粗大ごみ回収料金 */
    fee?: string[];
  };
};

export const GOMI_SOURCES: GomiSource[] = [
  {
    code: 'tachikawa',
    name: '立川市',
    url: 'https://www.opendata.metro.tokyo.lg.jp/tachikawa/132021_tachikawashi_garbage_separate.csv',
    sourceName: '立川市「ごみ分別辞典」（東京都オープンデータカタログサイト）',
    sourcePage: 'https://www.city.tachikawa.lg.jp/kurashi/gomi/index.html',
    expectedRows: 2082,
    columns: {
      item: ['ゴミの品目'],
      category: ['分別区分'],
      // `注意点` は全件空なので `備考` へフォールバックする
      note: ['注意点', '備考'],
      // 列は存在するが全件空。取り込み時に検出され hasKana=false になる
      kana: ['ゴミの品目_カナ'],
      fee: ['粗大ごみ回収料金'],
    },
  },
  {
    code: 'nakano',
    name: '中野区',
    url: 'https://www2.wagmap.jp/nakanodatamap/nakanodatamap/opendatafile/map_1/CSV/opendata_5000769.csv',
    sourceName: '中野区「ごみ分別一覧」（なかのデータマップ オープンデータ）',
    sourcePage: 'https://www.city.tokyo-nakano.lg.jp/kurashi/gomi/index.html',
    expectedRows: 942,
    columns: {
      item: ['ごみの品目'],
      category: ['種別'],
      note: ['説明'],
      // 全件ひらがなで入っている。調査JSONには載っていなかった掘り出し物
      kana: ['インデックス'],
      // 料金列そのものが無い。粗大ごみは料金を答えず受付センターへ送る
    },
  },
];
