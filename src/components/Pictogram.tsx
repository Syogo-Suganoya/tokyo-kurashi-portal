/**
 * 図記号（ピクトグラム）一式。
 *
 * 案内標識のピクトグラムに寄せた線画にしている。絵文字ではなく線画にしたのは、
 * 分野の色帯と同じ太さ・同じ描き味で並べたいため。装飾ではなく見分けるための記号。
 *
 * 絵文字は端末ごとに絵柄も太さも変わる。とくにごみの分別区分は
 * 「🔥＝燃やすごみ」のような当てはめになり、住民が読み取れる保証がない。
 * ここでは線の太さと画角を揃えた1組として持つ。
 *
 * 図記号だけで意味が伝わることは期待していない。どの画面でも必ず言葉が隣にあり、
 * 図記号は `aria-hidden` にして読み上げから外す。
 */

import type { GlyphName, ToolIcon } from '@/types/glyph';

export type { GlyphName, ToolIcon };

const GLYPHS: Record<GlyphName, React.ReactNode> = {
  // --- 簡易版4本 ---
  // ごみ箱
  gomi: <path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 12.5h9L17.5 7M10 11v5M14 11v5" />,
  // 集計の棒グラフ。盾にすると「危険」の印象を与えるため、あくまで数字の画面だと示す
  bouhan: <path d="M4 20h16M7 20v-6M12 20V6M17 20v-9" />,
  // 開いた本
  manabi: (
    <path d="M12 6.5C10.5 5 8 4.5 4 5v13c4-.5 6.5 0 8 1.5 1.5-1.5 4-2 8-1.5V5c-4-.5-6.5 0-8 1.5ZM12 6.5v13" />
  ),
  // 車椅子
  barrierfree: (
    <>
      <circle cx="9.5" cy="17" r="4" />
      <circle cx="13" cy="4.5" r="1.6" />
      <path d="M13 8v5h4l3 5M13 13H9.5" />
    </>
  ),

  // --- ごみの分別区分 ---
  // 炎
  burnable: (
    <path d="M12 2.7c.4 2.6 1.7 3.9 3.1 5.4C16.5 9.6 17.5 11 17.5 13a5.5 5.5 0 0 1-11 0c0-2 .9-3.3 2-4.6.5-.6.9-1.2 1.1-1.9.5.6.9 1.3 1.1 2.1.5-1.6.7-3.6 1.2-6Z" />
  ),
  // 割れたコップ。「燃やさないごみ」の中身は陶器・ガラス・金属であることが多い
  non_burnable: (
    <path d="M7.5 4h9l-1 15.6a1 1 0 0 1-1 .9h-5a1 1 0 0 1-1-.9L7.5 4ZM12 7.2l-1.6 3.2h3.2L12 13.6" />
  ),
  // 回る2本の矢印
  recyclable: (
    <path d="M5.2 10.2A7.4 7.4 0 0 1 18.1 7.9M18.6 4.4v3.7h-3.7M18.8 13.8A7.4 7.4 0 0 1 5.9 16.1M5.4 19.6v-3.7h3.7" />
  ),
  // ソファ。粗大ごみの代表格
  oversized: (
    <path d="M6 12.5V8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4.5M3 16.5v-3.2a1.5 1.5 0 0 1 3 0v3.2M18 16.5v-3.2a1.5 1.5 0 0 1 3 0v3.2M5 16.5h14M5.5 16.5V19M18.5 16.5V19" />
  ),
  // 警告の三角
  hazardous: <path d="M12 4.2 21.3 19.8H2.7ZM12 10v4M12 17.3v.1" />,
  // 開いた箱に上から入れる。「収集はしないが持ち込めば受け付ける」
  drop_off: <path d="M12 2.8v6.4M9.2 6.6 12 9.4l2.8-2.8M3 12.6h18M4.6 12.6v7.2h14.8v-7.2" />,
  // 禁止
  not_collected: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M6 18 18 6" />
    </>
  ),
  // 疑問符
  other: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M9.6 9.4a2.5 2.5 0 0 1 4.9.8c0 1.7-2.5 2-2.5 3.8M12 17.2v.1" />
    </>
  ),
};

export function Pictogram({ name, className = 'h-7 w-7' }: { name: GlyphName; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {GLYPHS[name]}
    </svg>
  );
}
