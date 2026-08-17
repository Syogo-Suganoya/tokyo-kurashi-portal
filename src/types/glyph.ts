/**
 * 画面に出す図記号の名前。
 *
 * 絵文字を文字列で持ち回すのをやめて名前だけを持つ。実体は `components/Pictogram.tsx`。
 * 絵文字は端末ごとに絵柄も太さも変わるうえ、読み上げの読み方も選べない。
 * 案内標識の語彙で作っているこの画面では、線の太さが揃わない時点で標識として成立しない。
 *
 * 名前にしておくと、存在しない図記号を指定した時点でコンパイルエラーになる。
 */

import type { GomiCategoryKey } from '@/lib/gomi/types';

/** 簡易版4本そのものを指す図記号 */
export type ToolIcon = 'gomi' | 'bouhan' | 'manabi' | 'barrierfree';

/** 図記号の名前。ごみの分別区分は正規化キーをそのまま図記号の名前として使う */
export type GlyphName = ToolIcon | GomiCategoryKey;
