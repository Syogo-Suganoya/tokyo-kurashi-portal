/**
 * 東京都の62区市町村（23区・26市・5町・8村）
 *
 * 警視庁の犯罪データは `市区町丁` が「千代田区丸の内１丁目」のように1列に連結されている。
 * これを区市町村と町丁に割るために使う。
 *
 * 「最初に現れる 区/市/町/村 で切る」という処理は**必ず壊れる**。
 *   - 武蔵村山市 → 「武蔵村」＋「山市」
 *   - 羽村市     → 「羽村」＋「市」
 * 名前の一覧を持って長い順に前方一致させるのが唯一の正しい解き方。
 */

export const TOKYO_MUNICIPALITIES = [
  // 23区
  '千代田区', '中央区', '港区', '新宿区', '文京区', '台東区', '墨田区', '江東区',
  '品川区', '目黒区', '大田区', '世田谷区', '渋谷区', '中野区', '杉並区', '豊島区',
  '北区', '荒川区', '板橋区', '練馬区', '足立区', '葛飾区', '江戸川区',
  // 26市
  '八王子市', '立川市', '武蔵野市', '三鷹市', '青梅市', '府中市', '昭島市', '調布市',
  '町田市', '小金井市', '小平市', '日野市', '東村山市', '国分寺市', '国立市', '福生市',
  '狛江市', '東大和市', '清瀬市', '東久留米市', '武蔵村山市', '多摩市', '稲城市',
  '羽村市', 'あきる野市', '西東京市',
  // 5町
  '瑞穂町', '日の出町', '奥多摩町', '大島町', '八丈町',
  // 8村
  '檜原村', '利島村', '新島村', '神津島村', '三宅村', '御蔵島村', '青ヶ島村', '小笠原村',
] as const;

/** 長い順。「武蔵村山市」を「武蔵村」より先に当てるため */
const BY_LENGTH_DESC = [...TOKYO_MUNICIPALITIES].sort((a, b) => b.length - a.length);

/**
 * 区市町村名の前に置かれることがある郡名・島名。
 * 23区と市はいきなり市区町村名で始まるが、町村部だけは
 * 「西多摩郡瑞穂町大字殿ケ谷」「三宅島三宅村神着」のように前置がある。
 * 単純な前方一致にすると町村部が丸ごと落ちる。
 */
const QUALIFIER = /(郡|島)$/;

export type SplitArea = {
  municipality: string;
  /** 町丁。集計行では空文字または「計」になる */
  town: string;
  /** 前置されていた郡名・島名（「西多摩郡」など） */
  qualifier: string;
};

/**
 * 「千代田区丸の内１丁目」    → `{ municipality: '千代田区', town: '丸の内１丁目' }`
 * 「西多摩郡瑞穂町長岡１丁目」 → `{ municipality: '瑞穂町', town: '長岡１丁目', qualifier: '西多摩郡' }`
 *
 * 区市町村名として解釈できない文字列（「２３区計」「合計」「他県」などの集計行）は null を返す。
 */
export function splitAreaName(areaName: string): SplitArea | null {
  for (const municipality of BY_LENGTH_DESC) {
    const at = areaName.indexOf(municipality);
    if (at < 0) continue;
    const qualifier = areaName.slice(0, at);
    // 前置は郡名・島名だけを許す。町丁名の途中にたまたま含まれていた場合を弾く
    if (qualifier !== '' && !QUALIFIER.test(qualifier)) continue;
    return { municipality, town: areaName.slice(at + municipality.length), qualifier };
  }
  return null;
}

