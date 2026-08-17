/**
 * AIに渡すツール定義（設計書 §4.1）
 *
 * ■ この設計の要点（設計書 §4.2）
 *
 * AIがやるのは次の2つだけ。
 *   1. どのツールを呼ぶか
 *   2. 入力文から品目名・自治体名・分野を抜き出すか
 *
 * **答えの本文はAIが作らない。** 分別区分・注意点・料金はツールの戻り値
 * （オープンデータそのもの）をそのまま画面に出す。AIが分別区分を創作する経路は無い。
 *
 * **URLもAIが作らない。** `no_tool` が返せるのは下の `KnownTopic` の列挙値だけで、
 * そこからキュレーションDBのIDへサーバ側で写像する。
 * AIが生成した文字列がリンク先になることはなく、存在しない行政URLの提示は構造上起こり得ない。
 */

import type { LinkId } from '@/data/links';
import { MANABI_KINDS } from '@/lib/manabi/search';
import { FEATURE_KEYS, FEATURE_LABEL } from '@/lib/barrierfree/types';

/** AIに提示する施設区分。取り込んだデータの区分そのものなので、勝手な区分名は出てこない */
const MANABI_KIND_NAMES = MANABI_KINDS;

/**
 * `no_tool` が返せる分野。自由記述ではなく閉じた列挙にすることが要点。
 *
 * **設計書 §10 の12テーマすべてに受け皿を用意する。** 受け皿が無い分野は `other` に落ちて
 * 汎用の横断検索へ流れてしまい、住民から見れば「答えてくれない」のと変わらない。
 * 自前の簡易版を持たない分野こそ、担当している既存サービスへ正確に送ることに価値がある。
 */
export const KNOWN_TOPICS = [
  'bousai', // 1 防災
  'bouhan', // 2 防犯（簡易版あり。場所が取れないときだけここへ）
  'kenko', // 3 健康・医療
  'kikou', // 5 気候変動
  'seikatsu', // 6 生活（税金・支援）
  'zeikin', // 6 生活のうち税金の使い道
  'shakai', // 7 社会参加
  'kodomo', // 8 子ども・若者
  'fukushi', // 9 福祉
  'digital', // 10 デジタル
  'kotsu', // 11 交通
  'kanko', // 12 観光
  'other', // どれにも当てはまらないとき
] as const;

export type KnownTopic = (typeof KNOWN_TOPICS)[number];

/**
 * 分野 → キュレーションDBのID。AIの出力が触れるのはキーだけで、URLには届かない。
 * 4 環境（ごみ）と 2 防犯 は自前の簡易版が答えるため、ここには出口だけを置く。
 */
export const TOPIC_LINKS: Record<KnownTopic, { message: string; linkIds: LinkId[] }> = {
  bousai: {
    message: '防災については、東京都の公式情報がまとまっています。',
    linkIds: ['tokyo-bousai'],
  },
  bouhan: {
    message: '防犯については、地図で見られる公式サービスがあります。町丁名が分かれば件数もお答えできます。',
    linkIds: ['tokyo-bouhan-map', 'keishicho-hassei-map'],
  },
  kenko: {
    message: '健康・医療については、公式の検索サービスがあります。こころの相談窓口もこちらから探せます。',
    linkIds: ['tokyo-navii', 'zenkoku-aed-map', 'mamorouyo-kokoro'],
  },
  kikou: {
    message: '暑さ対策については、涼める場所を地図で探せるサービスがあります。',
    linkIds: ['tokyo-coolshare'],
  },
  seikatsu: {
    message: '暮らしの支援制度は、都の横断検索から探せます。',
    linkIds: ['tokyo-shien-navi'],
  },
  zeikin: {
    message: '税金の使い道は、都のダッシュボードで見られます。',
    linkIds: ['shintosei-zeishunyu'],
  },
  shakai: {
    message: 'ボランティアや地域活動は、東京ボランティア・市民活動センターが窓口です。',
    linkIds: ['tvac-volunteer'],
  },
  kodomo: {
    message: '子ども・若者の相談は、都の専門窓口が対応しています。',
    linkIds: ['wakanavi-alpha', 'tokyo-shien-navi'],
  },
  fukushi: {
    message: 'こども食堂については、全国をカバーした地図があります。',
    linkIds: ['kodomo-shokudo-map'],
  },
  digital: {
    message: '都の手続きやお知らせは、公式アプリとMy TOKYOにまとまっています。',
    linkIds: ['tokyo-app', 'my-tokyo'],
  },
  kotsu: {
    message:
      '乗り換えや経路の案内は民間のサービスが十分に優れているため、自前では持っていません。駅のバリアフリー設備であればこの画面で調べられます。',
    linkIds: ['toei-kotsu', 'daredemo-tokyo'],
  },
  kanko: {
    message: '観光については、都の公式サイトが充実しています。',
    linkIds: ['go-tokyo'],
  },
  other: {
    message: 'この分野はまだ自前の簡易版を持っていません。都の横断検索から探せます。',
    linkIds: ['tokyo-shien-navi'],
  },
};

export const SYSTEM_INSTRUCTION = `あなたは東京都の生活情報ポータル「くらしの道しるべ」のルーターです。
住民の困りごとを読み、呼ぶべきツールを1つだけ選んでください。

厳守事項:
- あなたは答えを書きません。ごみの分別区分・注意点・料金・施設名などを自分で書いてはいけません。
- URLを書いてはいけません。
- ごみの捨て方・分別・粗大ごみに関する質問なら search_gomi を呼びます。
- 品目名は住民が書いたままの言葉を item に入れます（「ペットボトル」「アイロン台」など）。
- 区市町村が文中に無ければ municipality は省略します。推測してはいけません。
- 治安・犯罪の件数・引っ越し先の比較に関する質問なら search_bouhan を呼びます。
- 地名は住民が書いたままの文字で area に入れます。数字を漢数字に直したり、逆に直したりしてはいけません（「西新宿７丁目」はそのまま「西新宿７丁目」）。
- 図書館・博物館・公民館・青少年施設など、学びや体験ができる場所を探す質問なら search_manabi を呼びます。
- 車椅子・バリアフリー・オストメイトなど、行ける場所の設備に関する質問なら search_barrierfree を呼びます。
- 上記のいずれでもない分野は no_tool を呼び、topic に最も近い分野を選びます。`;

/**
 * Workers AI に渡すツール宣言。
 *
 * Workers AI は `{ name, description, parameters }` の形をそのまま受け取る
 * （OpenAI形式の `{ type: 'function', function: {...} }` も通るが、素の形の方が短い）。
 * `parameters` は JSON Schema なので、`enum` に**こちらが持っている値だけ**を並べておく。
 * 施設区分も設備キーも取り込んだデータから生成しているので、AIが知らない区分名を作る余地が無い。
 */
type ToolParameter = {
  type: string;
  description: string;
  /** 取りうる値を閉じた列挙にする。ここが空だとAIが知らない区分名を作れてしまう */
  enum?: readonly string[];
  items?: { type: string; enum?: readonly string[] };
};

export type AiTool = {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ToolParameter>;
    required?: string[];
  };
};

export const AI_TOOLS: AiTool[] = [
  {
    name: 'search_gomi',
    description:
      'ごみの分別・捨て方・粗大ごみについて、東京都のオープンデータから調べる。答えの本文はこのツールが返す。',
    parameters: {
      type: 'object',
      properties: {
        item: {
          type: 'string',
          description: '捨てたいものの名前。住民が書いたままの言葉（例: ペットボトル、アイロン台）',
        },
        municipality: {
          type: 'string',
          description:
            'お住まいの区市町村名（例: 立川市、中野区）。文中に無ければ省略する。推測しない',
        },
      },
      required: ['item'],
    },
  },
  {
    name: 'search_bouhan',
    description:
      '町丁ごとの犯罪認知件数を、警視庁のオープンデータから調べる。答えの本文はこのツールが返す。治安の良し悪しを判定するものではない。',
    parameters: {
      type: 'object',
      properties: {
        area: {
          type: 'string',
          description: '町丁名または区市町村名（例: 丸の内１丁目、西新宿、立川市）',
        },
      },
      required: ['area'],
    },
  },
  {
    name: 'search_manabi',
    description:
      '図書館・博物館・公民館・青少年施設など、東京都内の社会教育施設を探す。答えの本文はこのツールが返す。',
    parameters: {
      type: 'object',
      properties: {
        municipality: {
          type: 'string',
          description: '区市町村名（例: 中野区、立川市）。文中に無ければ省略する。推測しない',
        },
        kinds: {
          type: 'array',
          items: { type: 'string', enum: [...MANABI_KIND_NAMES] },
          description: '施設の種類。指定が無ければ省略して全種別を対象にする',
        },
        q: {
          type: 'string',
          description: '施設名や所在地に含まれるキーワード。無ければ省略する',
        },
      },
    },
  },
  {
    name: 'search_barrierfree',
    description:
      '車椅子で行ける飲食店・鉄道駅・公共施設を、必要な設備の条件で探す。答えの本文はこのツールが返す。',
    parameters: {
      type: 'object',
      properties: {
        features: {
          type: 'array',
          items: { type: 'string', enum: [...FEATURE_KEYS] },
          description: `必要な設備。${FEATURE_KEYS.map((k) => `${k}=${FEATURE_LABEL[k]}`).join('、')}`,
        },
        category: {
          type: 'string',
          enum: ['restaurant', 'station', 'facility'],
          description: '場所の種類。指定が無ければ省略する',
        },
        municipality: { type: 'string', description: '区市町村名。文中に無ければ省略する' },
        q: { type: 'string', description: '名前や住所のキーワード。無ければ省略する' },
      },
    },
  },
  {
    name: 'no_tool',
    description:
      'ごみ分別以外の分野。自前の簡易版が無いため、既存の公式サービスを案内する。',
    parameters: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          enum: [...KNOWN_TOPICS],
          description: '困りごとに最も近い分野',
        },
      },
      required: ['topic'],
    },
  },
];
