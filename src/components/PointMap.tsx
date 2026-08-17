'use client';

/**
 * 点を並べる地図。`/manabi` と `/barrierfree` が共有する。
 *
 * 背景地図は国土地理院の淡色地図タイル。行政のオープンデータを行政の地図に載せる形になり、
 * APIキーも利用登録も要らないので、デモ当日に外部サービスの都合で地図が消えることがない。
 * 出典表示は利用規約上の義務なので attribution に必ず入れる。
 *
 * 座標系は元データが JGD2011。地図表示の用途では WGS84 と同一視して実用上問題ない。
 *
 * 点の中身は画面ごとに違うので、この部品は「名前・種別・数行の説明」しか知らない。
 * 施設なのか飲食店なのかを判断するのは呼ぶ側の仕事。
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

export type MapPoint = {
  lat: number;
  lon: number;
  /** 選んだときに出す見出し */
  name: string;
  /** 見出しの上に出す小さな行（種別など） */
  meta: string;
  /** 色分けの区分。`palette` のキーと対応する */
  tone: string;
  /** 見出しの下に並べる説明。空文字は落とす */
  body: string[];
};

export function PointMap({
  points,
  palette,
  fallbackColor = '#17408b',
  height = 'h-[26rem]',
}: {
  points: MapPoint[];
  /** 種別ごとの色。凡例は呼ぶ側が出す */
  palette: Record<string, string>;
  fallbackColor?: string;
  height?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  /**
   * 最新の点を click ハンドラから読む。ハンドラは地図に一度しか登録しないので、
   * 点を直接閉じ込めると絞り込みを変えた後に古い点を返してしまう
   */
  const latest = useRef(points);
  const [selected, setSelected] = useState<MapPoint | null>(null);
  /**
   * スタイルの読み込み完了を state で持つ。
   * `once('load')` を点の描画側で待つ作りにすると、開発時の再マウントで
   * 破棄済みインスタンスの load を待ち続け、点が永久に描かれない。
   */
  const [loaded, setLoaded] = useState(false);

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

  useEffect(() => {
    latest.current = points;
  }, [points]);

  // 絞り込みが変わるたびに点を差し替え、表示範囲を合わせる
  useEffect(() => {
    const instance = map.current;
    if (!instance || !loaded) return;

    setSelected(null);

    const geojson = {
      type: 'FeatureCollection' as const,
      features: points.map((p, index) => ({
        type: 'Feature' as const,
        id: index,
        geometry: { type: 'Point' as const, coordinates: [p.lon, p.lat] },
        properties: { index, tone: p.tone },
      })),
    };

    const source = instance.getSource('points') as GeoJSONSource | undefined;
    if (source) {
      source.setData(geojson);
    } else {
      instance.addSource('points', { type: 'geojson', data: geojson });
      instance.addLayer({
        id: 'point-circles',
        type: 'circle',
        source: 'points',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 3.5, 14, 8],
          'circle-color': [
            'match',
            ['get', 'tone'],
            ...Object.entries(palette).flat(),
            fallbackColor,
          ] as never,
          'circle-opacity': 0.85,
          'circle-stroke-width': 1.2,
          'circle-stroke-color': '#ffffff',
        },
      });
      instance.on('click', 'point-circles', (event) => {
        const index = event.features?.[0]?.properties?.index;
        if (typeof index === 'number') setSelected(latest.current[index] ?? null);
      });
      instance.on('mouseenter', 'point-circles', () => {
        instance.getCanvas().style.cursor = 'pointer';
      });
      instance.on('mouseleave', 'point-circles', () => {
        instance.getCanvas().style.cursor = '';
      });
    }

    if (points.length > 0) {
      const bounds = new LngLatBounds();
      for (const p of points) bounds.extend([p.lon, p.lat]);
      instance.fitBounds(bounds, { padding: 48, maxZoom: 15, duration: 0 });
    }
  }, [points, loaded, palette, fallbackColor]);

  return (
    <div className="relative overflow-hidden rounded-xl border border-line">
      <div ref={container} className={`w-full ${height}`} />
      {selected && (
        <div className="absolute inset-x-3 bottom-3 rounded-lg border border-line bg-surface p-4 shadow-lg">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {/*
                色は点と対応させるための丸で示す。文字そのものを塗ると、
                地図の点として見やすい濃さが、そのまま文字としては読みにくい濃さになる
              */}
              <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
                <span
                  aria-hidden
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-white"
                  style={{ backgroundColor: palette[selected.tone] ?? fallbackColor }}
                />
                {selected.meta}
              </p>
              <p className="mt-1 font-bold">{selected.name}</p>
              {selected.body
                .filter(Boolean)
                .map((line) => (
                  <p key={line} className="mt-1 text-sm text-muted">
                    {line}
                  </p>
                ))}
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

/** 色分けの凡例。地図の色が何を指すのかは画面に書かないと伝わらない */
export function MapLegend({ palette }: { palette: Record<string, string> }) {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      {Object.entries(palette).map(([label, color]) => (
        <li key={label} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5 rounded-full ring-1 ring-white"
            style={{ backgroundColor: color }}
          />
          {label}
        </li>
      ))}
    </ul>
  );
}
