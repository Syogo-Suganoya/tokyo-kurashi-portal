/**
 * 困りごとチャットのAPI（設計書 §4）
 *
 * 流れ:
 *   1. routeQuery でツールとパラメータを決める（AIの仕事はここまで）
 *   2. ツールを実行して答えを組み立てる（オープンデータそのもの）
 *   3. 共通画面契約（AnswerResult）で返す
 *
 * APIキーはサーバ側だけで読む。ブラウザには渡さない。
 */

import { NextResponse } from 'next/server';

import { getLink, type LinkId } from '@/data/links';
import { routeQuery, townFromText } from '@/lib/ai/route-query';
import { TOPIC_LINKS } from '@/lib/ai/tools';
import { searchBouhan, type BouhanSearchResult } from '@/lib/bouhan/search';
import { itemFromText, searchGomi, type GomiSearchResult } from '@/lib/gomi/search';
import { searchManabi, type ManabiSearchResult } from '@/lib/manabi/search';
import { searchBarrierFree, type BarrierFreeSearchResult } from '@/lib/barrierfree/search';

export type ChatResponse =
  /** ごみ分別の簡易版が答えを返せた（または返せない理由を共通契約で返した） */
  | { type: 'answer'; via: string; item: string; municipality: string; result: GomiSearchResult }
  /** 防犯の簡易版が答えを返せた */
  | { type: 'bouhan'; via: string; area: string; result: BouhanSearchResult }
  /** 学びと体験の場の簡易版が答えを返せた */
  | { type: 'manabi'; via: string; query: string; result: ManabiSearchResult }
  /** バリアフリーの簡易版が答えを返せた */
  | { type: 'barrierfree'; via: string; query: string; result: BarrierFreeSearchResult }
  /**
   * 自治体が特定できないので1問だけ聞き返す（設計書 §4.3）。
   * 推測で答えない。分別ルールは自治体ごとに違うため、推測は誤情報になる
   */
  | { type: 'ask_municipality'; via: string; item: string; message: string }
  /** 簡易版が無い分野。キュレーションDBのリンクを返す（設計書 §4.4） */
  | {
      type: 'links';
      via: string;
      message: string;
      links: { id: LinkId; org: string; name: string; url: string }[];
    }
  | { type: 'error'; message: string };

export async function POST(request: Request): Promise<NextResponse<ChatResponse>> {
  let body: { message?: unknown; municipality?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ type: 'error', message: 'リクエストを読み取れませんでした' }, { status: 400 });
  }

  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message) {
    return NextResponse.json({ type: 'error', message: '困りごとを入力してください' }, { status: 400 });
  }
  // セッションで保持している自治体。一度答えたら以降は聞き返さない（設計書 §4.3）
  const remembered = typeof body.municipality === 'string' ? body.municipality.trim() : '';

  const { routed, via, fallbackReason } = await routeQuery(message);
  const viaLabel =
    via === 'workers-ai' ? 'Workers AI' : `キーワード判定（${fallbackReason ?? '—'}）`;

  if (routed.tool === 'search_bouhan') {
    /*
     * AIが渡してきた地名で引けなかったら、住民が書いた文から取り直す。
     * モデルは地名を書き換えてくる（「西新宿７丁目」→「西新宿七丁部」を実測）。
     * 書き換えた側だけを信じると、住民が正しく書いた町丁が0件になる。
     */
    let area = routed.area;
    let result = searchBouhan({ area });
    if (result.answer === null) {
      const fromText = townFromText(message);
      if (fromText && fromText !== area) {
        const retried = searchBouhan({ area: fromText });
        if (retried.answer !== null) {
          area = fromText;
          result = retried;
        }
      }
    }
    return NextResponse.json({ type: 'bouhan', via: viaLabel, area, result });
  }

  if (routed.tool === 'search_manabi') {
    const query = new URLSearchParams();
    if (routed.municipality) query.set('m', routed.municipality);
    for (const kind of routed.kinds ?? []) query.append('k', kind);
    if (routed.q) query.set('q', routed.q);
    return NextResponse.json({
      type: 'manabi',
      via: viaLabel,
      // 地図で見たい人を /manabi へ渡すためのクエリ文字列
      query: query.toString(),
      result: searchManabi(routed),
    });
  }

  if (routed.tool === 'search_barrierfree') {
    const query = new URLSearchParams();
    for (const feature of routed.features ?? []) query.append('f', feature);
    if (routed.category) query.set('c', routed.category);
    if (routed.municipality) query.set('m', routed.municipality);
    if (routed.q) query.set('q', routed.q);
    return NextResponse.json({
      type: 'barrierfree',
      via: viaLabel,
      query: query.toString(),
      result: searchBarrierFree(routed),
    });
  }

  if (routed.tool === 'no_tool') {
    const topic = TOPIC_LINKS[routed.topic];
    return NextResponse.json({
      type: 'links',
      via: viaLabel,
      message: topic.message,
      // AIが触れるのは分野キーまで。URLはここでキュレーションDBから引く
      links: topic.linkIds.map((id) => ({ id, ...getLink(id) })),
    });
  }

  const municipality = routed.municipality || remembered;
  if (!municipality) {
    return NextResponse.json({
      type: 'ask_municipality',
      via: viaLabel,
      item: routed.item,
      message: 'どちらの区市町村にお住まいですか？ ごみの分別は自治体ごとに違うため、推測ではお答えできません。',
    });
  }

  /*
   * 地名と同じで、品目名もAIが書き換えてくる（「アイロン台」→「アイロン天」を実測）。
   * 引けなかったら住民が書いた文から品目名を拾い直す。拾えるのは実在する品目だけ。
   */
  let item = routed.item;
  let result = searchGomi({ item, municipality });
  if (result.answer === null) {
    const fromText = itemFromText(message, municipality);
    if (fromText && fromText !== item) {
      const retried = searchGomi({ item: fromText, municipality });
      if (retried.answer !== null) {
        item = fromText;
        result = retried;
      }
    }
  }

  return NextResponse.json({
    type: 'answer',
    via: viaLabel,
    item,
    municipality,
    // 答えの本文はここで作られる。AIは一切関与しない（設計書 §4.2）
    result,
  });
}
