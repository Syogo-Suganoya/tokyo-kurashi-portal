/**
 * 表記ゆれを吸収した検索キーへの正規化。
 *
 * 取り込みスクリプト（ビルド時）と検索（実行時）の両方から使う。
 * 同じ関数を通さないと「取り込み時に作った検索キー」と「入力から作った検索キー」が
 * ずれて検索が黙って0件になるため、必ずここに一本化する。
 *
 * カタカナ→ひらがな、全角英数→半角、大文字→小文字に揃え、
 * 検索の邪魔にしかならない記号（空白・中黒・長音・括弧類）を落とす。
 */
export function normalizeSearchKey(input: string): string {
  return input
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/[\s・･ー\-‐－—〜~()（）「」【】［］\[\]、,.。]/g, '');
}
