/**
 * 学びと体験の場の地図（設計書 §3.3）
 *
 * 地図そのものは `PointMap` が持つ。ここは「施設をどう点にするか」だけを決める。
 */

import { PointMap, type MapPoint } from '@/components/PointMap';
import type { ManabiFacility } from '@/lib/manabi/types';

/** 9種別を色で塗り分けると見分けがつかなくなるので、種別は選んだときの文字で示す */
const PALETTE = { 施設: '#16603f' };

export function FacilityMap({ facilities }: { facilities: ManabiFacility[] }) {
  // 座標を持たない施設は地図に置けない（元データに緯度経度が無いものが実在する）
  const points: MapPoint[] = facilities
    .filter((f) => f.lat !== undefined && f.lon !== undefined)
    .map((f) => ({
      lat: f.lat as number,
      lon: f.lon as number,
      name: f.n,
      meta: f.outside ? `${f.k} ・ ${f.pref ?? '都外'}` : `${f.k} ・ ${f.m}`,
      tone: '施設',
      body: [f.a, f.tel ?? ''],
    }));

  return <PointMap points={points} palette={PALETTE} />;
}
