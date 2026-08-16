'use client';

/**
 * 施設の地図（設計書 §3.3）
 *
 * 地図の学習コストをこの1画面に閉じ込める（設計書 §7）。他の簡易版は地図を使わない。
 *
 * 背景地図は国土地理院の淡色地図タイル。行政のオープンデータを行政の地図に載せる形になり、
 * APIキーも利用登録も要らないので、デモ当日に外部サービスの都合で地図が消えることがない。
 * 出典表示は利用規約上の義務なので attribution に必ず入れる。
 *
 * 座標系は元データが JGD2011。地図表示の用途では WGS84 と同一視して実用上問題ない。
 */

// maplibre-gl v6 はデフォルトエクスポートを持たない。名前付きで取る
import {
  LngLatBounds,
  MapLibreMap,
  NavigationControl,
  setWorkerUrl,
  type GeoJSONSource,
} from 'maplibre-gl';
import { useEffect, useRef, useState } from 'react';

import type { ManabiFacility } from '@/lib/manabi/types';
import { manabiIcon } from '@/lib/manabi/types';

import 'maplibre-gl/dist/maplibre-gl.css';

/**
 * ワーカーの場所を明示する。Next.js (Turbopack) では既定の解決が効かず、
 * ワーカーの取得が HTML を返して失敗し、地図タイルは出るのに点だけが描かれなくなる。
 * 実体は scripts/copy-map-worker.mjs が node_modules から public/ へ配置する。
 */
setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');

/** 都心を中心にした初期表示 */
const INITIAL_CENTER: [number, number] = [139.7454, 35.6586];
const INITIAL_ZOOM = 9.5;

export function FacilityMap({ facilities }: { facilities: ManabiFacility[] }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const [selected, setSelected] = useState<ManabiFacility | null>(null);
  /**
   * スタイルの読み込み完了を state で持つ。
   * `once('load')` を点の描画側で待つ作りにすると、開発時の再マウントで
   * 破棄済みインスタンスの load を待ち続け、点が永久に描かれない。
   */
  const [loaded, setLoaded] = useState(false);

  // 座標を持たない施設は地図に置けない（元データに緯度経度が無いものが実在する）
  const plotted = facilities.filter((f) => f.lat !== undefined && f.lon !== undefined);

  useEffect(() => {
    if (!container.current || map.current) return;

    map.current = new MapLibreMap({
      container: container.current,
      style: {
        version: 8,
        sources: {
          gsi: {
            type: 'raster',
            tiles: ['https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png'],
            tileSize: 256,
            maxzoom: 18,
            attribution:
              '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noreferrer">国土地理院</a>',
          },
        },
        layers: [{ id: 'gsi', type: 'raster', source: 'gsi' }],
      },
      center: INITIAL_CENTER,
      zoom: INITIAL_ZOOM,
    });
    map.current.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    map.current.on('load', () => setLoaded(true));

    return () => {
      setLoaded(false);
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // 絞り込みが変わるたびに点を差し替え、表示範囲を合わせる
  useEffect(() => {
    const instance = map.current;
    if (!instance || !loaded) return;

    const geojson = {
      type: 'FeatureCollection' as const,
      features: plotted.map((f, index) => ({
        type: 'Feature' as const,
        id: index,
        geometry: { type: 'Point' as const, coordinates: [f.lon as number, f.lat as number] },
        properties: { index },
      })),
    };

    const apply = () => {
      const source = instance.getSource('facilities') as GeoJSONSource | undefined;
      if (source) {
        source.setData(geojson);
      } else {
        instance.addSource('facilities', { type: 'geojson', data: geojson });
        instance.addLayer({
          id: 'facility-points',
          type: 'circle',
          source: 'facilities',
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 4, 14, 8],
            'circle-color': '#16603f',
            'circle-opacity': 0.85,
            'circle-stroke-width': 1.5,
            'circle-stroke-color': '#ffffff',
          },
        });
        instance.on('click', 'facility-points', (event) => {
          const index = event.features?.[0]?.properties?.index;
          if (typeof index === 'number') setSelected(plotted[index] ?? null);
        });
        instance.on('mouseenter', 'facility-points', () => {
          instance.getCanvas().style.cursor = 'pointer';
        });
        instance.on('mouseleave', 'facility-points', () => {
          instance.getCanvas().style.cursor = '';
        });
      }

      if (plotted.length > 0) {
        const bounds = new LngLatBounds();
        for (const f of plotted) bounds.extend([f.lon as number, f.lat as number]);
        instance.fitBounds(bounds, { padding: 48, maxZoom: 15, duration: 0 });
      }
    };

    apply();
  }, [plotted, loaded]);

  return (
    <div className="relative overflow-hidden rounded-xl border border-line">
      <div ref={container} className="h-[26rem] w-full" />
      {selected && (
        <div className="absolute inset-x-3 bottom-3 rounded-lg border border-line bg-surface p-4 shadow-lg">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-muted">
                {manabiIcon(selected.k)} {selected.k}
                {selected.outside && ` ・ ${selected.pref ?? '都外'}`}
              </p>
              <p className="mt-1 font-bold">{selected.n}</p>
              <p className="mt-1 text-sm text-muted">{selected.a}</p>
              {selected.tel && <p className="text-sm text-muted">{selected.tel}</p>}
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              aria-label="閉じる"
              className="shrink-0 rounded px-2 py-1 text-sm text-muted hover:bg-background"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
