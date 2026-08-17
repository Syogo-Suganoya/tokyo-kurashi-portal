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
  return kanjiNumbersToDigits(input)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/[\s・･ー\-‐－—〜~()（）「」【】［］\[\]、,.。]/g, '');
}

const KANJI_DIGITS = '〇一二三四五六七八九';

/**
 * 「七丁目」を「7丁目」に揃える。
 *
 * 元データの町丁名は全角数字（西新宿７丁目）だが、住民は漢数字でも書く。
 * 実際、チャットのAIも入力の「７丁目」を「七丁目」に書き換えてくることがあり、
 * それだけで検索が0件になっていた。**入り口を広げる側で受け止める。**
 *
 * **対象は「丁目」の直前だけ**にする。「番」まで広げると千代田区一番町・三番町のような
 * 実在の町名を数字に化けさせてしまう。あれは番地ではなく町の名前。
 */
function kanjiNumbersToDigits(input: string): string {
  return input.replace(/[〇一二三四五六七八九十]+(?=丁目)/g, (match) => {
    // 十一 → 11、二十 → 20、十 → 10 まで扱えれば町丁名には足りる
    const tens = match.indexOf('十');
    if (tens === -1) {
      return [...match].map((c) => KANJI_DIGITS.indexOf(c)).join('');
    }
    const upper = tens === 0 ? 1 : KANJI_DIGITS.indexOf(match[tens - 1]);
    const lower = tens === match.length - 1 ? 0 : KANJI_DIGITS.indexOf(match[tens + 1]);
    if (upper < 0 || lower < 0) return match;
    return String(upper * 10 + lower);
  });
}
