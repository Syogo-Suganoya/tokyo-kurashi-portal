/**
 * バリアフリー 簡易版 `/barrierfree`（設計書 §3.4）
 *
 * 交通局・産業労働局・福祉局が別々に公開しているデータを、
 * 住民の関心事である「車椅子で行ける場所か」の1軸に束ねる。
 *
 * 主役は**条件で絞れるリスト＋詳細カード**（設計書 §3.4）。条件で絞れることがこの画面の
 * 価値であり、「どの設備があると書かれているか」は地図の点では表せないため。
 * 地図はその後に足す。絞った結果がどこに集まっているかは、リストでは読み取れない。
 */

import Link from 'next/link';

import { AnswerCard } from '@/components/AnswerCard';
import { BarrierFreeMap } from '@/components/BarrierFreeMap';
import { Pictogram } from '@/components/Pictogram';
import { MANABI_MUNICIPALITIES } from '@/lib/manabi/search';
import { BARRIERFREE_ORGS, searchBarrierFree } from '@/lib/barrierfree/search';
import {
  FEATURE_KEYS,
  FEATURE_LABEL,
  SPOT_ICON,
  SPOT_LABEL,
  type BarrierFreeSpot,
  type FeatureKey,
  type SpotCategory,
} from '@/lib/barrierfree/types';

export const metadata = {
  title: '車椅子で行ける場所をさがす｜くらしの道しるべ',
};

const LIST_LIMIT = 40;

function asArray(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

export default async function BarrierFreePage({ searchParams }: PageProps<'/barrierfree'>) {
  const params = await searchParams;
  const features = asArray(params.f);
  const category = typeof params.c === 'string' ? (params.c as SpotCategory) : '';
  const municipality = typeof params.m === 'string' ? params.m : '';
  const q = typeof params.q === 'string' ? params.q : '';

  const result = searchBarrierFree({
    ...(features.length > 0 ? { features } : {}),
    ...(category ? { category } : {}),
    ...(municipality ? { municipality } : {}),
    ...(q ? { q } : {}),
  });

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10">
      <p className="text-sm">
        <Link href="/" className="text-muted underline underline-offset-2 hover:no-underline">
          くらしの道しるべ
        </Link>
      </p>
      <h1 className="signboard mt-2 text-3xl">車椅子で行ける場所をさがす</h1>
      <p className="mt-3 max-w-3xl leading-relaxed text-muted">
        バリアフリーの情報は、東京都の中でも
        {BARRIERFREE_ORGS.map((o) => o.org).join('・')}
        が別々に公開しています。ここでは
        <strong className="text-foreground">それを1つにまとめて条件で絞り込めるように</strong>
        しました。
      </p>
      <p className="mt-2 max-w-3xl rounded-lg bg-warn-soft p-3 text-sm leading-relaxed text-warn">
        条件で絞ると、残るのは「その条件があると<strong>明記されている</strong>場所」だけです。
        絞り込みから漏れた場所は、条件を満たさないのではなく、多くは元データが未記入です。
        「なし」と書かれていない限り、この画面は「なし」とは表示しません。
      </p>

      <form method="get" className="mt-8 rounded-xl border border-line bg-surface p-5">
        <fieldset>
          <legend className="text-sm font-semibold">必要な条件</legend>
          <div className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {FEATURE_KEYS.map((feature) => (
              <label key={feature} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="f"
                  value={feature}
                  defaultChecked={features.includes(feature)}
                />
                <span>{FEATURE_LABEL[feature]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="text-sm font-semibold">場所の種類</span>
            <select
              name="c"
              defaultValue={category}
              className="mt-1 w-full rounded-lg border border-line bg-background px-3 py-2"
            >
              <option value="">すべて</option>
              {(Object.keys(SPOT_LABEL) as SpotCategory[]).map((c) => (
                <option key={c} value={c}>
                  {SPOT_LABEL[c]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-semibold">区市町村</span>
            <select
              name="m"
              defaultValue={municipality}
              className="mt-1 w-full rounded-lg border border-line bg-background px-3 py-2"
            >
              <option value="">すべて</option>
              {MANABI_MUNICIPALITIES.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-semibold">名前・住所で絞る</span>
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="新宿"
              className="mt-1 w-full rounded-lg border border-line bg-background px-3 py-2"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="submit" className="rounded-lg bg-accent px-5 py-2 font-semibold text-surface">
            さがす
          </button>
          <span className="text-sm text-muted">
            例：
            <Link
              href="/barrierfree?f=wheelchair_entry&f=accessible_toilet&c=restaurant"
              className="underline underline-offset-2 hover:no-underline"
            >
              車椅子で入れてトイレもある飲食店
            </Link>
            、
            <Link
              href="/barrierfree?f=ostomate&c=station"
              className="underline underline-offset-2 hover:no-underline"
            >
              オストメイト設備のある駅
            </Link>
          </span>
        </div>
      </form>

      <div className="mt-8">
        <AnswerCard result={result} />
      </div>

      {result.spots.length > 0 && (
        <section className="mt-6">
          <h2 className="eyebrow text-muted">地図で見る</h2>
          <div className="mt-3">
            <BarrierFreeMap spots={result.spots} />
          </div>
        </section>
      )}

      {result.spots.length > 0 && (
        <section className="mt-6 rounded-xl border border-line bg-surface p-5">
          <h2 className="eyebrow text-muted">
            一覧（{result.spots.length.toLocaleString()}か所
            {result.spots.length > LIST_LIMIT && ` のうち${LIST_LIMIT}か所を表示`}）
          </h2>
          <ul className="mt-3 divide-y divide-line">
            {result.spots.slice(0, LIST_LIMIT).map((spot) => (
              <SpotRow key={`${spot.c}-${spot.n}-${spot.a}-${spot.sub ?? ''}`} spot={spot} />
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function SpotRow({ spot }: { spot: BarrierFreeSpot }) {
  return (
    <li className="py-4">
      <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
        <Pictogram name={SPOT_ICON[spot.c]} className="h-4 w-4 shrink-0" />
        {SPOT_LABEL[spot.c]}
        {spot.sub && ` ・ ${spot.sub}`}
        <span className="ml-2 rounded bg-background px-2 py-0.5">出典: 東京都{spot.org}</span>
      </p>
      <p className="mt-1 font-medium">
        {spot.url ? (
          <a
            href={spot.url}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 hover:no-underline"
          >
            {spot.n}
          </a>
        ) : (
          spot.n
        )}
      </p>
      {(spot.a || spot.tel) && (
        <p className="text-sm text-muted">
          {spot.a}
          {spot.tel && `${spot.a ? ' ／ ' : ''}${spot.tel}`}
        </p>
      )}
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {FEATURE_KEYS.map((key) => (
          <FeatureChip key={key} feature={key} state={spot.f[key]} />
        ))}
      </ul>
    </li>
  );
}

/**
 * 3つの状態を見た目で明確に分ける。
 * とくに「情報なし」を「なし」と読ませないことが重要（設計書 §3.4）。
 */
function FeatureChip({ feature, state }: { feature: FeatureKey; state?: string }) {
  if (state === 'yes') {
    return (
      <li className="text-accent">
        <span aria-hidden>○</span> {FEATURE_LABEL[feature]}
      </li>
    );
  }
  if (state === 'no') {
    return (
      <li className="text-warn">
        <span aria-hidden>×</span> {FEATURE_LABEL[feature]}（元データに「なし」と記載）
      </li>
    );
  }
  return (
    <li className="text-muted">
      <span aria-hidden>—</span> {FEATURE_LABEL[feature]}（情報なし）
    </li>
  );
}
