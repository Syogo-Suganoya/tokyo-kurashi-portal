/**
 * ごみ分別オープンデータの取り込み設定（ビルド時のみ使用）
 *
 * **この配列は `npx tsx scripts/discover-gomi-sources.ts` の出力を貼ったもの。**
 * 全数調査の結果（docs/gomi_taiou_jichitai.json）に、東京都オープンデータカタログが持つ
 * 各自治体の公式ページURLを突き合わせ、CSVと公式ページの両方に疎通確認を通したものだけが残る。
 * 自治体を増やすときは調査JSONを更新して再生成する。
 *
 * ■ 取り込まない自治体
 * - 世田谷区：列とデータがズレている（設計書 §2.2①）。特例処理を書くまで入れない
 * - 台東区：カタログのCSVが404（§2.2②）
 * - 東村山市：公式ページに繋がらず、案内先を確保できない
 *
 * ■ 列名は「単一の列名」ではなく「候補の配列」で持つ
 *
 * 実データを検証したところ、調査JSONの列マッピングをそのまま信じると壊れるケースが実在した。
 *
 *   - 立川市の `注意点` 列は 2,082件すべて空。実際の注意文は `備考` 列にある
 *   - 立川市の `ゴミの品目_カナ` 列も全件空。カナ検索には使えない
 *   - 中野区の `インデックス` 列は 942件すべてひらがな。カナ検索に使える（調査JSONには未記載）
 *
 * そこで候補を順に見て「最初に中身が入っていた列」を採用する。
 * 空の列を掴んで注意点が全部消える、という事故が起きない。
 *
 * ■ sourcePage と pageKind
 *
 * `sourcePage` は住民への案内先。`pageKind` が `gomi` ならごみの案内ページ、
 * `site` なら公式サイトのトップである。**ごみのページだと確認できないものをごみのページとして
 * 案内しない**ため区別している（候補には「区の花」の紹介ページのような無関係なものも混ざる）。
 */

export type GomiSource = {
  code: string;
  name: string;
  url: string;
  sourceName: string;
  /** 住民向けの案内先。CSVそのものではなく人が読めるページ */
  sourcePage: string;
  /** 案内先がごみの案内ページか、公式サイトのトップか */
  pageKind: 'gomi' | 'site';
  /** 期待件数。取り込み結果がこれと食い違ったら警告する */
  expectedRows: number;
  columns: {
    /**
     * 品目名。必須。
     * 調査で確認した列名を先頭に置き、他自治体で見られた列名を後ろに足してある。
     * 公開側で列名が変わっても、よくある綴りなら拾えるようにするため
     */
    item: string[];
    /** 分別区分。必須。item と同じ考え方で候補を並べる */
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
    code: 'mizuho',
    name: '瑞穂町',
    url: 'https://www.opendata.metro.tokyo.lg.jp/mizuho/133035_mizuhomachi_garbage_separate.csv',
    sourceName: '瑞穂町「ごみ分別」（東京都オープンデータカタログサイト）',
    sourcePage: 'http://www.town.mizuho.tokyo.jp/',
    pageKind: 'site',
    expectedRows: 2437,
    columns: {
      item: ["ゴミの品目", "ごみの品目", "品目", "品名", "ゴミの分別方法_品目", "ゴミの品目名"],
      category: ["分別区分", "種別", "ゴミの分別方法_分別区分", "区分"],
      note: ["備考","注意点","説明"],
      kana: ["ゴミの品目_カナ","インデックス","カナ"],
      fee: ["粗大ごみ回収料金","料金","料金種別"],
    },
  },
  {
    code: 'tachikawa',
    name: '立川市',
    url: 'https://www.opendata.metro.tokyo.lg.jp/tachikawa/132021_tachikawashi_garbage_separate.csv',
    sourceName: '立川市「ごみ分別」（東京都オープンデータカタログサイト）',
    sourcePage: 'https://www.city.tachikawa.lg.jp/kurashi/gomi/1001712/index.html',
    pageKind: 'gomi',
    expectedRows: 2082,
    columns: {
      item: ["ゴミの品目", "ごみの品目", "品目", "品名", "ゴミの分別方法_品目", "ゴミの品目名"],
      category: ["分別区分", "種別", "ゴミの分別方法_分別区分", "区分"],
      note: ["注意点","備考","説明"],
      kana: ["ゴミの品目_カナ"],
      fee: ["粗大ごみ回収料金","料金","料金種別"],
    },
  },
  {
    code: 'tama',
    name: '多摩市',
    url: 'https://www.city.tama.lg.jp/_res/projects/default_project/_page_/001/012/082/132241_tamashi_garbage_separate.csv',
    sourceName: '多摩市「ごみ分別」（東京都オープンデータカタログサイト）',
    sourcePage: 'https://www.city.tama.lg.jp/kurashi/gomi/bunbetsu/1012082.html',
    pageKind: 'gomi',
    expectedRows: 1641,
    columns: {
      item: ["ゴミの品目", "ごみの品目", "品目", "品名", "ゴミの分別方法_品目", "ゴミの品目名"],
      category: ["分別区分", "種別", "ゴミの分別方法_分別区分", "区分"],
      note: ["注意点","備考","説明"],
      kana: ["ゴミの品目_カナ"],
      fee: ["粗大ごみ回収料金","料金","料金種別"],
    },
  },
  {
    code: 'hamura',
    name: '羽村市',
    url: 'https://www.opendata.metro.tokyo.lg.jp/hamura/132276_garbage_separation.csv',
    sourceName: '羽村市「ごみ分別」（東京都オープンデータカタログサイト）',
    sourcePage: 'https://www.city.hamura.tokyo.jp/',
    pageKind: 'site',
    expectedRows: 1618,
    columns: {
      item: ["品目", "ゴミの品目", "ごみの品目", "品名", "ゴミの分別方法_品目", "ゴミの品目名"],
      category: ["分別区分", "種別", "ゴミの分別方法_分別区分", "区分"],
      note: ["注意点","備考","説明"],
      kana: ["ゴミの品目_カナ","インデックス","カナ"],
      fee: ["料金種別","粗大ごみ回収料金","料金"],
    },
  },
  {
    code: 'fuchu',
    name: '府中市',
    url: 'https://www.city.fuchu.tokyo.jp/gyosei/opendata/index.files/132063_garbage_separation.csv',
    sourceName: '府中市「ごみ分別」（東京都オープンデータカタログサイト）',
    sourcePage: 'https://www.city.fuchu.tokyo.jp/shisetu/kankyo/seso/risaikuruplaza.html',
    pageKind: 'gomi',
    expectedRows: 1542,
    columns: {
      item: ["ゴミの品目", "ごみの品目", "品目", "品名", "ゴミの分別方法_品目", "ゴミの品目名"],
      category: ["分別区分", "種別", "ゴミの分別方法_分別区分", "区分"],
      note: ["注意点","備考","説明"],
      kana: ["ゴミの品目_カナ","インデックス","カナ"],
      fee: ["料金種別","粗大ごみ回収料金","料金"],
    },
  },
  {
    code: 'chofu',
    name: '調布市',
    url: 'https://www.city.chofu.lg.jp/documents/13850/132080_garbage_separation.csv',
    sourceName: '調布市「ごみ分別」（東京都オープンデータカタログサイト）',
    sourcePage: 'https://www.city.chofu.lg.jp/',
    pageKind: 'site',
    expectedRows: 1522,
    columns: {
      item: ["ゴミの品目", "ごみの品目", "品目", "品名", "ゴミの分別方法_品目", "ゴミの品目名"],
      category: ["分別区分", "種別", "ゴミの分別方法_分別区分", "区分"],
      note: ["注意点","備考","説明"],
      kana: ["ゴミの品目_カナ","インデックス","カナ"],
      fee: ["料金種別","粗大ごみ回収料金","料金"],
    },
  },
  {
    code: 'kokubunji',
    name: '国分寺市',
    url: 'https://www.opendata.metro.tokyo.lg.jp/kokubunji/132144_garbage_separation.csv',
    sourceName: '国分寺市「ごみ分別」（東京都オープンデータカタログサイト）',
    sourcePage: 'https://www.city.kokubunji.tokyo.jp/',
    pageKind: 'site',
    expectedRows: 1424,
    columns: {
      item: ["ゴミの品目", "ごみの品目", "品目", "品名", "ゴミの分別方法_品目", "ゴミの品目名"],
      category: ["分別区分", "種別", "ゴミの分別方法_分別区分", "区分"],
      note: ["注意点","備考","説明"],
      kana: ["ゴミの品目_カナ","インデックス","カナ"],
      fee: ["料金種別","粗大ごみ回収料金","料金"],
    },
  },
  {
    code: 'nishitokyo',
    name: '西東京市',
    url: 'https://www.opendata.metro.tokyo.lg.jp/nishitokyo/132292_garbage_separation.csv',
    sourceName: '西東京市「ごみ分別」（東京都オープンデータカタログサイト）',
    sourcePage: 'https://www.city.nishitokyo.lg.jp/kurasi/gomi_recycle/gomi-calebder/index.html',
    pageKind: 'gomi',
    expectedRows: 1258,
    columns: {
      item: ["ゴミの品目", "ごみの品目", "品目", "品名", "ゴミの分別方法_品目", "ゴミの品目名"],
      category: ["分別区分", "種別", "ゴミの分別方法_分別区分", "区分"],
      note: ["注意点","備考","説明"],
      kana: ["ゴミの品目_カナ"],
      fee: ["粗大ごみ回収料金","料金","料金種別"],
    },
  },
  {
    code: 'hachioji',
    name: '八王子市',
    url: 'https://www.city.hachioji.tokyo.jp/contents/open/002/p005873_d/fil/132012_garbage_separation.csv',
    sourceName: '八王子市「ごみ分別」（東京都オープンデータカタログサイト）',
    sourcePage: 'https://www.city.hachioji.tokyo.jp/',
    pageKind: 'site',
    expectedRows: 1084,
    columns: {
      item: ["ゴミの品目", "ごみの品目", "品目", "品名", "ゴミの分別方法_品目", "ゴミの品目名"],
      category: ["分別区分", "種別", "ゴミの分別方法_分別区分", "区分"],
      note: ["注意点","備考","説明"],
      kana: ["ゴミの品目_カナ","インデックス","カナ"],
      fee: ["料金種別","粗大ごみ回収料金","料金"],
    },
  },
  {
    code: 'itabashi',
    name: '板橋区',
    url: 'https://www.opendata.metro.tokyo.lg.jp/itabashi/131199_itabashiku_garbage_separate.csv',
    sourceName: '板橋区「ごみ分別」（東京都オープンデータカタログサイト）',
    sourcePage: 'https://www.city.itabashi.tokyo.jp/',
    pageKind: 'site',
    expectedRows: 1125,
    columns: {
      item: ["ゴミの品目", "ごみの品目", "品目", "品名", "ゴミの分別方法_品目", "ゴミの品目名"],
      category: ["分別区分", "種別", "ゴミの分別方法_分別区分", "区分"],
      note: ["注意点","備考","説明"],
      kana: ["ゴミの品目_カナ"],
      fee: ["粗大ごみ回収料金","料金","料金種別"],
    },
  },
  {
    code: 'higashikurume',
    name: '東久留米市',
    url: 'https://www.opendata.metro.tokyo.lg.jp/higashikurume/132225_higashikurumeshi_garbage_separate.csv',
    sourceName: '東久留米市「ごみ分別」（東京都オープンデータカタログサイト）',
    sourcePage: 'https://www.city.higashikurume.lg.jp/kurashi/kankyo/shigen/index.html',
    pageKind: 'gomi',
    expectedRows: 1108,
    columns: {
      item: ["ゴミの品目", "ごみの品目", "品目", "品名", "ゴミの分別方法_品目", "ゴミの品目名"],
      category: ["分別区分", "種別", "ゴミの分別方法_分別区分", "区分"],
      note: ["注意点","備考","説明"],
      kana: ["ゴミの品目_カナ"],
      fee: ["粗大ごみ回収料金","料金","料金種別"],
    },
  },
  {
    code: 'koto',
    name: '江東区',
    url: 'https://www.opendata.metro.tokyo.lg.jp/koto/131083_028_garbage_separation.csv',
    sourceName: '江東区「ごみ分別」（東京都オープンデータカタログサイト）',
    sourcePage: 'https://www.city.koto.lg.jp/388001/kurashi/gomi/kate/sodaigomi/7369.html',
    pageKind: 'gomi',
    expectedRows: 1104,
    columns: {
      item: ["ゴミの品目", "ごみの品目", "品目", "品名", "ゴミの分別方法_品目", "ゴミの品目名"],
      category: ["分別区分", "種別", "ゴミの分別方法_分別区分", "区分"],
      note: ["注意点","備考","説明"],
      kana: ["ゴミの品目_カナ","インデックス","カナ"],
      fee: ["料金種別","粗大ごみ回収料金","料金"],
    },
  },
  {
    code: 'koganei',
    name: '小金井市',
    url: 'https://www.opendata.metro.tokyo.lg.jp/koganei/28_gomibunbetsu.csv',
    sourceName: '小金井市「ごみ分別」（東京都オープンデータカタログサイト）',
    sourcePage: 'https://www.city.koganei.lg.jp/smph/kurashi/446/gomidashikata/gomitebiki/index.html',
    pageKind: 'gomi',
    expectedRows: 994,
    columns: {
      item: ["品目", "ゴミの品目", "ごみの品目", "品名", "ゴミの分別方法_品目", "ゴミの品目名"],
      category: ["分別区分", "種別", "ゴミの分別方法_分別区分", "区分"],
      note: ["注意点","備考","説明"],
      kana: ["ゴミの品目_カナ","インデックス","カナ"],
      fee: ["料金種別","粗大ごみ回収料金","料金"],
    },
  },
  {
    code: 'bunkyo',
    name: '文京区',
    url: 'https://www.city.bunkyo.lg.jp/documents/6059/bunbetuhinmoku.csv',
    sourceName: '文京区「ごみ分別」（東京都オープンデータカタログサイト）',
    sourcePage: 'https://www.city.bunkyo.lg.jp/',
    pageKind: 'site',
    expectedRows: 979,
    columns: {
      item: ["品名", "ゴミの品目", "ごみの品目", "品目", "ゴミの分別方法_品目", "ゴミの品目名"],
      category: ["種別", "分別区分", "ゴミの分別方法_分別区分", "区分"],
      note: ["説明","注意点","備考"],
      kana: ["ゴミの品目_カナ","インデックス","カナ"],
      fee: ["料金","粗大ごみ回収料金","料金種別"],
    },
  },
  {
    code: 'nakano',
    name: '中野区',
    url: 'https://www2.wagmap.jp/nakanodatamap/nakanodatamap/opendatafile/map_1/CSV/opendata_5000769.csv',
    sourceName: '中野区「ごみ分別」（東京都オープンデータカタログサイト）',
    sourcePage: 'https://www.city.tokyo-nakano.lg.jp/',
    pageKind: 'site',
    expectedRows: 942,
    columns: {
      item: ["ごみの品目", "ゴミの品目", "品目", "品名", "ゴミの分別方法_品目", "ゴミの品目名"],
      category: ["種別", "分別区分", "ゴミの分別方法_分別区分", "区分"],
      note: ["説明","注意点","備考"],
      kana: ["ゴミの品目_カナ","インデックス","カナ"],
      fee: ["粗大ごみ回収料金","料金","料金種別"],
    },
  },
  {
    code: 'hino',
    name: '日野市',
    url: 'https://www.opendata.metro.tokyo.lg.jp/hino/132128_hinoshi_garbage_separate.csv',
    sourceName: '日野市「ごみ分別」（東京都オープンデータカタログサイト）',
    sourcePage: 'https://www.city.hino.lg.jp/kurashi/gomi/kihon/1002861.html',
    pageKind: 'gomi',
    expectedRows: 826,
    columns: {
      item: ["ゴミの品目", "ごみの品目", "品目", "品名", "ゴミの分別方法_品目", "ゴミの品目名"],
      category: ["分別区分", "種別", "ゴミの分別方法_分別区分", "区分"],
      note: ["注意点","備考","説明"],
      kana: ["ゴミの品目_カナ"],
      fee: ["粗大ごみ回収料金","料金","料金種別"],
    },
  },
  {
    code: 'katsushika',
    name: '葛飾区',
    url: 'https://www.opendata.metro.tokyo.lg.jp/katsushika/131229_garbage_separation.csv',
    sourceName: '葛飾区「ごみ分別」（東京都オープンデータカタログサイト）',
    sourcePage: 'https://www.city.katsushika.lg.jp/',
    pageKind: 'site',
    expectedRows: 755,
    columns: {
      item: ["ゴミの品目", "ごみの品目", "品目", "品名", "ゴミの分別方法_品目", "ゴミの品目名"],
      category: ["分別区分", "種別", "ゴミの分別方法_分別区分", "区分"],
      note: ["注意点","備考","説明"],
      kana: ["ゴミの品目_カナ","インデックス","カナ"],
      fee: ["料金種別","粗大ごみ回収料金","料金"],
    },
  },
  {
    code: 'musashino',
    name: '武蔵野市',
    url: 'https://www.opendata.metro.tokyo.lg.jp/musashino/132039_garbage_separation.csv',
    sourceName: '武蔵野市「ごみ分別」（東京都オープンデータカタログサイト）',
    sourcePage: 'https://www.city.musashino.lg.jp/',
    pageKind: 'site',
    expectedRows: 620,
    columns: {
      item: ["ゴミの品目", "ごみの品目", "品目", "品名", "ゴミの分別方法_品目", "ゴミの品目名"],
      category: ["分別区分", "種別", "ゴミの分別方法_分別区分", "区分"],
      note: ["注意点","備考","説明"],
      kana: ["ゴミの品目_カナ","インデックス","カナ"],
      fee: ["料金種別","粗大ごみ回収料金","料金"],
    },
  },
  {
    code: 'mitaka',
    name: '三鷹市',
    url: 'https://www.city.mitaka.lg.jp/c_service/103/attached/attach_103696_2.csv',
    sourceName: '三鷹市「ごみ分別」（東京都オープンデータカタログサイト）',
    sourcePage: 'https://www.city.mitaka.lg.jp/',
    pageKind: 'site',
    expectedRows: 548,
    columns: {
      item: ["ゴミの品目", "ごみの品目", "品目", "品名", "ゴミの分別方法_品目", "ゴミの品目名"],
      category: ["分別区分", "種別", "ゴミの分別方法_分別区分", "区分"],
      note: ["注意点","備考","説明"],
      kana: ["ゴミの品目_カナ"],
      fee: ["粗大ごみ回収料金","料金","料金種別"],
    },
  },
  {
    code: 'shinjuku',
    name: '新宿区',
    url: 'https://www.city.shinjuku.lg.jp/content/000420404.csv',
    sourceName: '新宿区「ごみ分別」（東京都オープンデータカタログサイト）',
    sourcePage: 'https://www.city.shinjuku.lg.jp/',
    pageKind: 'site',
    expectedRows: 482,
    columns: {
      item: ["ゴミの品目", "ごみの品目", "品目", "品名", "ゴミの分別方法_品目", "ゴミの品目名"],
      category: ["分別区分", "種別", "ゴミの分別方法_分別区分", "区分"],
      note: ["注意点","備考","説明"],
      kana: ["ゴミの品目_カナ","インデックス","カナ"],
      fee: ["料金種別","粗大ごみ回収料金","料金"],
    },
  },
  {
    code: 'sumida',
    name: '墨田区',
    url: 'https://www.opendata.metro.tokyo.lg.jp/sumida/131075_garbage_separation.csv',
    sourceName: '墨田区「ごみ分別」（東京都オープンデータカタログサイト）',
    sourcePage: 'https://www.city.sumida.lg.jp/kuseijoho/sumida_info/opendata/opendata_ichiran/gomirecycle_data/bunbetu_data.html',
    pageKind: 'gomi',
    expectedRows: 476,
    columns: {
      item: ["品目", "ゴミの品目", "ごみの品目", "品名", "ゴミの分別方法_品目", "ゴミの品目名"],
      category: ["分別区分", "種別", "ゴミの分別方法_分別区分", "区分"],
      note: ["注意点","備考","説明"],
      kana: ["ゴミの品目_カナ","インデックス","カナ"],
      fee: ["料金種別","粗大ごみ回収料金","料金"],
    },
  },
  {
    code: 'chiyoda',
    name: '千代田区',
    url: 'https://www.opendata.metro.tokyo.lg.jp/chiyoda/131016_28garbage_separation.csv',
    sourceName: '千代田区「ごみ分別」（東京都オープンデータカタログサイト）',
    sourcePage: 'https://www.city.chiyoda.lg.jp/',
    pageKind: 'site',
    expectedRows: 446,
    columns: {
      item: ["ゴミの品目", "ごみの品目", "品目", "品名", "ゴミの分別方法_品目", "ゴミの品目名"],
      category: ["分別区分", "種別", "ゴミの分別方法_分別区分", "区分"],
      note: ["注意点","備考","説明"],
      kana: ["ゴミの品目_カナ","インデックス","カナ"],
      fee: ["料金種別","粗大ごみ回収料金","料金"],
    },
  },
  {
    code: 'shinagawa',
    name: '品川区',
    url: 'https://www.opendata.metro.tokyo.lg.jp/shinagawa/131091_garbage_separation.csv',
    sourceName: '品川区「ごみ分別」（東京都オープンデータカタログサイト）',
    sourcePage: 'https://www.city.shinagawa.tokyo.jp/PC/kankyo/kankyo-gomi/20230914124622.html',
    pageKind: 'gomi',
    expectedRows: 415,
    columns: {
      item: ["ゴミの品目", "ごみの品目", "品目", "品名", "ゴミの分別方法_品目", "ゴミの品目名"],
      category: ["分別区分", "種別", "ゴミの分別方法_分別区分", "区分"],
      note: ["注意点","備考","説明"],
      kana: ["ゴミの品目_カナ","インデックス","カナ"],
      fee: ["料金種別","粗大ごみ回収料金","料金"],
    },
  },
  {
    code: 'chuo',
    name: '中央区',
    url: 'https://www.city.chuo.lg.jp/documents/984/gominobunbetu.csv',
    sourceName: '中央区「ごみ分別」（東京都オープンデータカタログサイト）',
    sourcePage: 'https://www.city.chuo.lg.jp/kurashi/gomi/bunbetsu/wakekata/index.html',
    pageKind: 'gomi',
    expectedRows: 381,
    columns: {
      item: ["ゴミの品目", "ごみの品目", "品目", "品名", "ゴミの分別方法_品目", "ゴミの品目名"],
      category: ["分別区分", "種別", "ゴミの分別方法_分別区分", "区分"],
      note: ["注意点","備考","説明"],
      kana: ["ゴミの品目_カナ","インデックス","カナ"],
      fee: ["料金種別","粗大ごみ回収料金","料金"],
    },
  },
  {
    code: 'higashiyamato',
    name: '東大和市',
    url: 'https://www.opendata.metro.tokyo.lg.jp/higashiyamato/ods/132209_garbage_separation.csv',
    sourceName: '東大和市「ごみ分別」（東京都オープンデータカタログサイト）',
    sourcePage: 'https://www.city.higashiyamato.lg.jp/kurashi/gomirecycle/index.html',
    pageKind: 'gomi',
    expectedRows: 376,
    columns: {
      item: ["品目", "ゴミの品目", "ごみの品目", "品名", "ゴミの分別方法_品目", "ゴミの品目名"],
      category: ["分別区分", "種別", "ゴミの分別方法_分別区分", "区分"],
      note: ["注意点","備考","説明"],
      kana: ["ゴミの品目_カナ","インデックス","カナ"],
      fee: ["料金種別","粗大ごみ回収料金","料金"],
    },
  },
  {
    code: 'minato',
    name: '港区',
    url: 'https://opendata.city.minato.tokyo.jp/dataset/de618de7-7ebf-4b23-9a79-34b5fc2d38aa/resource/d5ce0578-c97b-4b54-bfee-27073d1bc9ee/download/bunbetuhinmoku.csv',
    sourceName: '港区「ごみ分別」（東京都オープンデータカタログサイト）',
    sourcePage: 'https://www.city.minato.tokyo.jp/kurashi/gomi/seso/toke/index.html',
    pageKind: 'gomi',
    expectedRows: 332,
    columns: {
      item: ["品名", "ゴミの品目", "ごみの品目", "品目", "ゴミの分別方法_品目", "ゴミの品目名"],
      category: ["種別", "分別区分", "ゴミの分別方法_分別区分", "区分"],
      note: ["説明","注意点","備考"],
      kana: ["ゴミの品目_カナ","インデックス","カナ"],
      fee: ["粗大ごみ収集手数料[円]","粗大ごみ回収料金","料金","料金種別"],
    },
  },
  {
    code: 'komae',
    name: '狛江市',
    url: 'https://www.opendata.metro.tokyo.lg.jp/komae/132195_garbage_separation.csv',
    sourceName: '狛江市「ごみ分別」（東京都オープンデータカタログサイト）',
    sourcePage: 'https://www.city.komae.tokyo.jp/',
    pageKind: 'site',
    expectedRows: 289,
    columns: {
      item: ["品目", "ゴミの品目", "ごみの品目", "品名", "ゴミの分別方法_品目", "ゴミの品目名"],
      category: ["分別区分", "種別", "ゴミの分別方法_分別区分", "区分"],
      note: ["注意点","備考","説明"],
      kana: ["ゴミの品目_カナ","インデックス","カナ"],
      fee: ["料金種別","粗大ごみ回収料金","料金"],
    },
  },
  {
    code: 'arakawa',
    name: '荒川区',
    url: 'https://www.opendata.metro.tokyo.lg.jp/arakawa/arakawa_gomihinmoku.csv',
    sourceName: '荒川区「ごみ分別」（東京都オープンデータカタログサイト）',
    sourcePage: 'https://www.city.arakawa.tokyo.jp/recycle/index.html',
    pageKind: 'gomi',
    expectedRows: 265,
    columns: {
      item: ["ゴミの品目", "ごみの品目", "品目", "品名", "ゴミの分別方法_品目", "ゴミの品目名"],
      category: ["分別区分", "種別", "ゴミの分別方法_分別区分", "区分"],
      note: ["注意点","備考","説明"],
      kana: ["ゴミの品目_カナ"],
      fee: ["粗大ごみ回収料金","料金","料金種別"],
    },
  },
  {
    code: 'suginami',
    name: '杉並区',
    url: 'https://www.city.suginami.tokyo.jp/documents/713/a2.csv',
    sourceName: '杉並区「ごみ分別」（東京都オープンデータカタログサイト）',
    sourcePage: 'https://www.city.suginami.tokyo.jp/',
    pageKind: 'site',
    expectedRows: 128,
    columns: {
      item: ["品目", "ゴミの品目", "ごみの品目", "品名", "ゴミの分別方法_品目", "ゴミの品目名"],
      category: ["分別区分", "種別", "ゴミの分別方法_分別区分", "区分"],
      note: ["注意点","備考","説明"],
      kana: ["ゴミの品目_カナ","インデックス","カナ"],
      fee: ["料金種別","粗大ごみ回収料金","料金"],
    },
  },
];
