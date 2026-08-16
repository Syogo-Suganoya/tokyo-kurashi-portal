/**
 * キュレーションDB（設計書 §10「既存サービス一覧（エスカレーション先マスタ）」）
 *
 * 外部DBは使わない（設計書 §7）。ここに実在するIDでしか参照できないようにすることで、
 * 「存在しない行政URLを画面に出す」経路を型で潰す（設計書 §4.2）。
 * LLMがURLを生成する余地は構造上どこにも無い。
 *
 * ここに載せるURLは、追加時に必ず実際にアクセスして疎通を確認すること。
 */

export type CuratedLink = {
  /** 掲載元の組織名。誰が言っていることなのかを画面に必ず出すため */
  org: string;
  /** リンクの表示名 */
  name: string;
  url: string;
};

export const CURATED_LINKS = {
  // --- ごみ分別（環境） ---
  'shibuya-gomi-hinmoku': {
    org: '渋谷区',
    name: 'ごみの品目別分別一覧（50音順）',
    url: 'https://www.city.shibuya.tokyo.jp/kurashi/gomi/kateigomi/gomi_hinmoku.html',
  },
  'nakano-gomi-chatbot': {
    org: '中野区',
    name: 'ごみ分別チャットボット',
    url: 'https://www.city.tokyo-nakano.lg.jp/kurashi/gomi/chatbot.html',
  },
  'nakano-gomi-top': {
    org: '中野区',
    name: 'ごみ・資源',
    url: 'https://www.city.tokyo-nakano.lg.jp/kurashi/gomi/index.html',
  },
  'nakano-sodai': {
    org: '中野区',
    name: '粗大ごみの申込み（粗大ごみ受付センター）',
    url: 'https://www.city.tokyo-nakano.lg.jp/kurashi/gomi/sodaigomi/index.html',
  },
  'tachikawa-gomi-top': {
    org: '立川市',
    name: 'ごみ・リサイクル',
    url: 'https://www.city.tachikawa.lg.jp/kurashi/gomi/index.html',
  },
  'tachikawa-sodai': {
    org: '立川市',
    name: '粗大ごみの出し方・収集の申込み',
    url: 'https://www.city.tachikawa.lg.jp/kurashi/gomi/1001712/1001732/index.html',
  },

  // --- 学びと体験の場 ---
  'tokyo-syougai-gakushu': {
    org: '東京都',
    name: '東京都生涯学習情報',
    url: 'https://www.syougai.metro.tokyo.lg.jp/',
  },
  'tokyo-kyoiku': {
    org: '東京都教育委員会',
    name: '公式ホームページ',
    url: 'https://www.kyoiku.metro.tokyo.lg.jp/',
  },

  // --- 他テーマ（Tier C・Dの主回答。今回は未使用だが §10 の初期データとして保持） ---
  'tokyo-bousai': {
    org: '東京都',
    name: '東京都防災ホームページ',
    url: 'https://www.bousai.metro.tokyo.lg.jp/1028747/',
  },
  'tokyo-bouhan-map': {
    org: '東京都防犯ネットワーク',
    name: '防犯マップ',
    url: 'https://www.bouhan.metro.tokyo.lg.jp/map/?m=1',
  },
  'keishicho-hassei-map': {
    org: '警視庁',
    name: '事件事故発生マップ',
    url: 'https://www.keishicho.metro.tokyo.lg.jp/jiken_jiko/hassei/map_annai.html',
  },
  'zenkoku-aed-map': {
    org: '日本救急医療財団',
    name: '全国AEDマップ',
    url: 'https://www.qqzaidanmap.jp/',
  },
  'kodomo-shokudo-map': {
    org: 'むすびえ × ガッコム',
    name: 'こども食堂マップ',
    url: 'https://kodomoshokudo.gaccom.jp/',
  },
  'tokyo-shien-navi': {
    org: '東京都',
    name: 'Tokyo支援ナビ',
    url: 'https://www.support-navi.metro.tokyo.lg.jp/',
  },
  'shintosei-zeishunyu': {
    org: '東京都',
    name: '都税収入見える化ダッシュボード',
    url: 'https://shintosei.metro.tokyo.lg.jp/sainyudashboard/',
  },
  'go-tokyo': {
    org: '東京都',
    name: 'GO TOKYO',
    url: 'https://www.gotokyo.org/jp/index.html',
  },
} as const satisfies Record<string, CuratedLink>;

/** キュレーションDBに実在するIDだけを許す。存在しないIDはコンパイルエラーになる */
export type LinkId = keyof typeof CURATED_LINKS;

export function getLink(id: LinkId): CuratedLink {
  return CURATED_LINKS[id];
}
