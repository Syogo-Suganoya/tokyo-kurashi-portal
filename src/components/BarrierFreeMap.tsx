/**
 * バリアフリーの地図（設計書 §3.4）
 *
 * 絞り込みの結果を地図でも見られるようにする。条件で絞ることがこの画面の価値なので
 * 主役はリストのままで、地図は「絞った結果がどこに集まっているか」を見るためのもの。
 *
 * 色は場所の種類で分ける。3つの局が別々に公開していたデータが1枚の地図に載っていることが、
 * 色の混ざり具合でそのまま見える。
 */

import { MapLegend, PointMap, type MapPoint } from '@/components/PointMap';
import { SPOT_LABEL, type BarrierFreeSpot } from '@/lib/barrierfree/types';

/** 分野の識別色と衝突しない範囲で、3種類が判別できる色にする */
const PALETTE: Record<string, string> = {
  [SPOT_LABEL.restaurant]: '#b8541a',
  [SPOT_LABEL.station]: '#17408b',
  [SPOT_LABEL.facility]: '#1f6b45',
};

/**
 * 地図に載せる上限。
 * 全件は6千を超え、点として送るとページの読み込みが重くなる。
 * 地図が要るのは絞り込んだ後なので、上限に当たったことを画面に書いて絞り込みを促す。
 */
export const MAP_LIMIT = 2000;

export function BarrierFreeMap({ spots }: { spots: BarrierFreeSpot[] }) {
  const plottable = spots.filter((s) => s.lat !== undefined && s.lon !== undefined);
  const shown = plottable.slice(0, MAP_LIMIT);

  if (shown.length === 0) return null;

  const points: MapPoint[] = shown.map((s) => ({
    lat: s.lat as number,
    lon: s.lon as number,
    name: s.n,
    meta: s.sub ? `${SPOT_LABEL[s.c]} ・ ${s.sub}` : SPOT_LABEL[s.c],
    tone: SPOT_LABEL[s.c],
    body: [s.a, s.tel ?? '', `出典：東京都${s.org}`],
  }));

  return (
    <div>
      <PointMap points={points} palette={PALETTE} height="h-[24rem]" />
      <MapLegend palette={PALETTE} />
      <p className="mt-2 text-xs text-muted">
        {plottable.length > MAP_LIMIT
          ? `座標を持つ${plottable.length.toLocaleString()}か所のうち、${MAP_LIMIT.toLocaleString()}か所までを地図に出しています。条件で絞ると全部が載ります。`
          : `地図には座標を持つ${plottable.length.toLocaleString()}か所を出しています。`}
        {spots.length > plottable.length &&
          `残る${(spots.length - plottable.length).toLocaleString()}か所は元データに座標がないため、下の一覧にだけ出ます。`}
      </p>
    </div>
  );
}
