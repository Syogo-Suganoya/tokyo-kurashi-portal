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

/** AIに提示する施設区分。取り込んだデータの区分そのものなので、勝手な区分名は出てこない */
const MANABI_KIND_NAMES = MANABI_KINDS;

/** `no_tool` が返せる分野。自由記述ではなく閉じた列挙にすることが要点 */
export const KNOWN_TOPICS = [
  'bousai',
  'bouhan',
  'kenko',
  'fukushi',
  'kodomo',
  'zeikin',
  'kanko',
  'other',
] as const;

export type KnownTopic = (typeof KNOWN_TOPICS)[number];

/** 分野 → キュレーションDBのID。AIの出力が触れるのはキーだけで、URLには届かない */
export const TOPIC_LINKS: Record<KnownTopic, { message: string; linkIds: LinkId[] }> = {
  bousai: {
    message: '防災については、東京都の公式情報がまとまっています。',
    linkIds: ['tokyo-bousai'],
  },
  bouhan: {
    message: '防犯については、地図で見られる公式サービスがあります。',
    linkIds: ['tokyo-bouhan-map', 'keishicho-hassei-map'],
  },
  kenko: {
    message: '健康・医療については、公式の検索サービスがあります。',
    linkIds: ['zenkoku-aed-map'],
  },
  fukushi: {
    message: 'こども食堂については、全国をカバーした地図があります。',
    linkIds: ['kodomo-shokudo-map'],
  },
  kodomo: {
    message: '子ども・若者の相談先は、都の窓口が対応しています。',
    linkIds: ['tokyo-shien-navi'],
  },
  zeikin: {
    message: '税金の使い道は、都のダッシュボードで見られます。',
    linkIds: ['shintosei-zeishunyu'],
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
- 図書館・博物館・公民館・青少年施設など、学びや体験ができる場所を探す質問なら search_manabi を呼びます。
- 上記のいずれでもない分野は no_tool を呼び、topic に最も近い分野を選びます。`;

/** @google/genai の interactions API に渡すツール宣言 */
export const GEMINI_TOOLS = [
  {
    type: 'function' as const,
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
    type: 'function' as const,
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
    type: 'function' as const,
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
    type: 'function' as const,
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
