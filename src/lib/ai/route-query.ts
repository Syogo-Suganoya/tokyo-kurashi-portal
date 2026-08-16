/**
 * 困りごとの文 → 「どのツールをどんなパラメータで呼ぶか」の決定（設計書 §4）
 *
 * Gemini API の function calling を使う。ここが返すのはツール名と引数だけで、
 * 住民に見せる答えの本文は一切含まない。
 *
 * APIキーが無いとき・API障害時は、キーワード一致のフォールバックに落ちる（設計書 §4.4）。
 * デモ当日にAPIが不調でも画面が死なないための保険であり、
 * 「AIが落ちたら何も答えられない」構造にしないための設計でもある。
 */

import { GoogleGenAI } from '@google/genai';

import { MUNICIPALITIES } from '@/data/municipalities';
import { TOKYO_MUNICIPALITIES } from '@/data/tokyo-municipalities';
import { MANABI_KINDS } from '@/lib/manabi/search';
import { FEATURE_KEYS, type FeatureKey, type SpotCategory } from '@/lib/barrierfree/types';

import { GEMINI_TOOLS, KNOWN_TOPICS, SYSTEM_INSTRUCTION, type KnownTopic } from './tools';

const MODEL = process.env.GEMINI_MODEL ?? 'gemini-3.6-flash';

export type RoutedQuery =
  | { tool: 'search_gomi'; item: string; municipality?: string }
  | { tool: 'search_bouhan'; area: string }
  | { tool: 'search_manabi'; municipality?: string; kinds?: string[]; q?: string }
  | {
      tool: 'search_barrierfree';
      features?: string[];
      category?: SpotCategory;
      municipality?: string;
      q?: string;
    }
  | { tool: 'no_tool'; topic: KnownTopic };

export type RouteOutcome = {
  routed: RoutedQuery;
  /** どちらの経路で決まったか。画面に出して、AIが落ちていることを隠さない */
  via: 'gemini' | 'fallback';
  /** フォールバックに落ちた理由 */
  fallbackReason?: string;
};

export async function routeQuery(message: string): Promise<RouteOutcome> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { routed: fallbackRoute(message), via: 'fallback', fallbackReason: 'APIキー未設定' };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const interaction = await ai.interactions.create({
      model: MODEL,
      system_instruction: SYSTEM_INSTRUCTION,
      input: message,
      tools: GEMINI_TOOLS,
    });

    for (const step of interaction.steps ?? []) {
      if (step.type !== 'function_call') continue;
      const routed = toRoutedQuery(step.name, step.arguments);
      if (routed) return { routed, via: 'gemini' };
    }
    // ツールを呼ばずに文章で返してきた場合。その文章は使わない（AIに答えさせない §4.2）
    return { routed: fallbackRoute(message), via: 'fallback', fallbackReason: 'ツールが選ばれなかった' };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error('[routeQuery] Gemini呼び出しに失敗:', reason);
    return { routed: fallbackRoute(message), via: 'fallback', fallbackReason: 'API呼び出しに失敗' };
  }
}

/**
 * AIの出力を、こちらが受け付ける形だけに絞り込む。
 * 知らないツール名・知らない分野は捨てる。AIの出力をそのまま信用しない。
 */
function toRoutedQuery(name: string, args: Record<string, unknown>): RoutedQuery | null {
  if (name === 'search_gomi') {
    const item = typeof args.item === 'string' ? args.item.trim() : '';
    if (!item) return null;
    const municipality =
      typeof args.municipality === 'string' && args.municipality.trim()
        ? args.municipality.trim()
        : undefined;
    return { tool: 'search_gomi', item, municipality };
  }
  if (name === 'search_bouhan') {
    const area = typeof args.area === 'string' ? args.area.trim() : '';
    if (!area) return null;
    return { tool: 'search_bouhan', area };
  }
  if (name === 'search_manabi') {
    // 施設区分はこちらが持っている区分名だけを通す。AIが作った区分名は捨てる
    const kinds = Array.isArray(args.kinds)
      ? args.kinds.filter((k): k is string => typeof k === 'string' && MANABI_KINDS.includes(k))
      : [];
    return {
      tool: 'search_manabi',
      ...(typeof args.municipality === 'string' && args.municipality.trim()
        ? { municipality: args.municipality.trim() }
        : {}),
      ...(kinds.length > 0 ? { kinds } : {}),
      ...(typeof args.q === 'string' && args.q.trim() ? { q: args.q.trim() } : {}),
    };
  }
  if (name === 'search_barrierfree') {
    // 設備キーはこちらが持っているものだけを通す
    const features = Array.isArray(args.features)
      ? args.features.filter((f): f is FeatureKey =>
          typeof f === 'string' && (FEATURE_KEYS as readonly string[]).includes(f),
        )
      : [];
    const category =
      args.category === 'restaurant' || args.category === 'station' || args.category === 'facility'
        ? args.category
        : undefined;
    return {
      tool: 'search_barrierfree',
      ...(features.length > 0 ? { features } : {}),
      ...(category ? { category } : {}),
      ...(typeof args.municipality === 'string' && args.municipality.trim()
        ? { municipality: args.municipality.trim() }
        : {}),
      ...(typeof args.q === 'string' && args.q.trim() ? { q: args.q.trim() } : {}),
    };
  }
  if (name === 'no_tool') {
    const topic = typeof args.topic === 'string' ? args.topic : '';
    return {
      tool: 'no_tool',
      topic: (KNOWN_TOPICS as readonly string[]).includes(topic) ? (topic as KnownTopic) : 'other',
    };
  }
  return null;
}

// --- 以下、LLMを使わないフォールバック（設計書 §4.4） ---

const GOMI_TRIGGER = /ごみ|ゴミ|捨て|すて|分別|粗大|処分|リサイクル/;
const BOUHAN_TRIGGER = /防犯|治安|犯罪|認知件数|空き巣|ひったくり|引っ越し先/;
const BARRIERFREE_TRIGGER = /車椅子|車いす|バリアフリー|オストメイト|多目的トイレ|多機能トイレ|段差/;
const MANABI_TRIGGER =
  /図書館|博物館|美術館|公民館|青少年|生涯学習|資料館|こどもと行|子どもと行|学べる|体験できる/;
/** 「西新宿７丁目」のような町丁名。全角・半角・漢数字に対応する */
const TOWN_PATTERN = /[^\s、。]{1,12}?[０-９0-9一二三四五六七八九十]+丁目/;

const TOPIC_TRIGGERS: ReadonlyArray<readonly [RegExp, KnownTopic]> = [
  [/防災|地震|台風|避難|災害/, 'bousai'],
  [/防犯|治安|犯罪|不審/, 'bouhan'],
  [/AED|病院|医療|救急|健康/i, 'kenko'],
  [/こども食堂|子ども食堂|食堂/, 'fukushi'],
  [/子育て|保育|若者|相談/, 'kodomo'],
  [/税金|都税|予算|使い道/, 'zeikin'],
  [/観光|旅行|お出かけ|名所/, 'kanko'],
];

/** 品目名の抽出。文末の言い回しを削るだけの素朴な処理でよい（緊急経路なので） */
const ITEM_TRAILERS =
  /(は|を|って|の|が)?\s*(どこに|どうやって|どのように|どう)?\s*(捨て[らるれ]?[ばるた]?[いのんですかまし]*|すて[らるれ]?[ばるた]?[いのんですかまし]*|処分|分別|出せ[ばるた]?[いのんですかまし]*|出し方|捨て方)[^。]*[。？?]?$/;

export function fallbackRoute(message: string): RoutedQuery {
  const text = message.trim();

  if (GOMI_TRIGGER.test(text)) {
    const municipality = MUNICIPALITIES.find((m) => text.includes(m.name))?.name;
    let item = text;
    if (municipality) item = item.replace(municipality, '');
    item = item.replace(ITEM_TRAILERS, '').replace(/[、,\s]+$/, '').trim();
    return { tool: 'search_gomi', item: item || text, municipality };
  }

  if (BARRIERFREE_TRIGGER.test(text)) {
    const municipality = TOKYO_MUNICIPALITIES.find((m) => text.includes(m));
    const category: SpotCategory | undefined = /店|食事|レストラン|飲食/.test(text)
      ? 'restaurant'
      : /駅|電車|地下鉄/.test(text)
        ? 'station'
        : undefined;
    const features = [
      /車椅子|車いす/.test(text) ? 'wheelchair_entry' : null,
      /トイレ/.test(text) ? 'accessible_toilet' : null,
      /オストメイト/.test(text) ? 'ostomate' : null,
      /段差/.test(text) ? 'step_free' : null,
    ].filter((f): f is string => f !== null);
    return {
      tool: 'search_barrierfree',
      ...(features.length > 0 ? { features } : {}),
      ...(category ? { category } : {}),
      ...(municipality ? { municipality } : {}),
    };
  }

  if (MANABI_TRIGGER.test(text)) {
    const municipality = TOKYO_MUNICIPALITIES.find((m) => text.includes(m));
    const kinds = MANABI_KINDS.filter((k) => text.includes(k));
    return {
      tool: 'search_manabi',
      ...(municipality ? { municipality } : {}),
      ...(kinds.length > 0 ? { kinds } : {}),
    };
  }

  if (BOUHAN_TRIGGER.test(text)) {
    // 場所が取り出せないと件数は出せない。取り出せなければ地図の公式サービスへ送る
    const area = TOWN_PATTERN.exec(text)?.[0] ?? TOKYO_MUNICIPALITIES.find((m) => text.includes(m));
    if (area) return { tool: 'search_bouhan', area };
    return { tool: 'no_tool', topic: 'bouhan' };
  }

  for (const [pattern, topic] of TOPIC_TRIGGERS) {
    if (pattern.test(text)) return { tool: 'no_tool', topic };
  }

  // 「ペットボトル」のように品目名だけを打った場合。どの分野のキーワードにも当たらず、
  // 質問の形もしていない短い語なら、持っている唯一の簡易版で引いてみる。
  // 外れても「見つかりませんでした」＋公式への案内が返るだけで、誤った答えにはならない
  if (text.length <= 20 && !/[？?]/.test(text)) {
    return { tool: 'search_gomi', item: text };
  }
  return { tool: 'no_tool', topic: 'other' };
}
