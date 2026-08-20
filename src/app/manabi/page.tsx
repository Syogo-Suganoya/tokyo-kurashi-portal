/**
 * 学びと体験の場 簡易版 `/manabi`（設計書 §3.3）
 *
 * 図書館・博物館・公民館・青少年施設などが種別ごとに別サイトに分かれている現状に対し、
 * 「近くで子どもと行ける場所」を種別をまたいで一望できるようにする。
 * 絞り込みはサーバ側で行い、地図だけがクライアント。
 */

import Link from 'next/link';

import { AnswerCard } from '@/components/AnswerCard';
import { SkipToAnswer } from '@/components/SkipToAnswer';
import { Pictogram } from '@/components/Pictogram';
import { FacilityMap } from '@/components/FacilityMap';
import {
  MANABI_KINDS,
  MANABI_MUNICIPALITIES,
  searchManabi,
} from '@/lib/manabi/search';
import { manabiIcon } from '@/lib/manabi/types';

export const metadata = {
  title: '学びと体験の場をさがす｜くらしの道しるべ',
};

/** 一覧に出す上限。849件を全部並べても読めないため */
const LIST_LIMIT = 60;

function asArray(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

export default async function ManabiPage({ searchParams }: PageProps<'/manabi'>) {
  const params = await searchParams;
  const municipality = typeof params.m === 'string' ? params.m : '';
  const kinds = asArray(params.k);
  const q = typeof params.q === 'string' ? params.q : '';

  const result = searchManabi({
    ...(municipality ? { municipality } : {}),
    ...(kinds.length > 0 ? { kinds } : {}),
    ...(q ? { q } : {}),
  });

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10">
      <p className="text-sm">
        <Link href="/" className="text-muted underline underline-offset-2 hover:no-underline">
          くらしの道しるべ
        </Link>
      </p>
      <h1 className="signboard mt-2 text-3xl">学びと体験の場をさがす</h1>
      <SkipToAnswer />
      <p className="mt-3 max-w-3xl leading-relaxed text-muted">
        図書館・博物館・公民館・青少年施設などは、種別ごとに別々のサイトで案内されています。
        ここでは東京都教育庁が公開する9種別を
        <strong className="text-foreground">1つの地図にまとめて</strong>
        、種別をまたいで探せるようにしています。
      </p>

      <form method="get" className="mt-8 rounded-xl border border-line bg-surface p-5">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,14rem)_1fr]">
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
            <span className="text-sm font-semibold">施設名・所在地で絞り込む</span>
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="こども"
              className="mt-1 w-full rounded-lg border border-line bg-background px-3 py-2"
            />
          </label>
        </div>

        <fieldset className="mt-4">
          <legend className="text-sm font-semibold">施設の種類（選ばなければすべて）</legend>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
            {MANABI_KINDS.map((kind) => (
              <label key={kind} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="k" value={kind} defaultChecked={kinds.includes(kind)} />
                <span className="flex items-center gap-1.5">
                  <Pictogram name={manabiIcon(kind)} className="h-4 w-4 shrink-0 text-muted" />
                  {kind}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="submit" className="rounded-lg bg-accent px-5 py-2 font-semibold text-surface">
            さがす
          </button>
          <span className="text-sm text-muted">
            例：
            <Link
              href="/manabi?m=%E4%B8%AD%E9%87%8E%E5%8C%BA"
              className="underline underline-offset-2 hover:no-underline"
            >
              中野区のすべて
            </Link>
            、
            <Link
              href="/manabi?k=%E5%8D%9A%E7%89%A9%E9%A4%A8&k=%E5%8D%9A%E7%89%A9%E9%A4%A8%E9%A1%9E%E4%BC%BC%E6%96%BD%E8%A8%AD"
              className="underline underline-offset-2 hover:no-underline"
            >
              博物館だけ
            </Link>
            、
            <Link
              href="/manabi?k=%E9%9D%92%E5%B0%91%E5%B9%B4%E6%96%BD%E8%A8%AD"
              className="underline underline-offset-2 hover:no-underline"
            >
              青少年施設
            </Link>
          </span>
        </div>
      </form>

      <div id="answer" tabIndex={-1} className="mt-8">
        <AnswerCard result={result} />
      </div>

      {result.facilities.length > 0 && (
        <>
          <div className="mt-6">
            <FacilityMap facilities={result.facilities} />
          </div>

          <section className="mt-6 rounded-xl border border-line bg-surface p-5">
            <h2 className="eyebrow text-muted">
              一覧（{result.facilities.length.toLocaleString()}件
              {result.facilities.length > LIST_LIMIT && ` のうち${LIST_LIMIT}件を表示`}）
            </h2>
            <ul className="mt-3 divide-y divide-line">
              {result.facilities.slice(0, LIST_LIMIT).map((facility) => (
                <li key={`${facility.n}-${facility.a}`} className="py-3">
                  <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                    <Pictogram name={manabiIcon(facility.k)} className="h-4 w-4 shrink-0" />
                    {facility.k} ・ {facility.m}
                    {facility.outside && (
                      <span className="ml-2 rounded bg-warn-soft px-2 py-0.5 font-semibold text-warn">
                        都外（{facility.pref ?? '東京都外'}）
                      </span>
                    )}
                    {facility.lat === undefined && (
                      <span className="ml-2 rounded bg-warn-soft px-2 py-0.5 font-semibold text-warn">
                        地図に表示できません
                      </span>
                    )}
                  </p>
                  <p className="mt-1 font-medium">{facility.n}</p>
                  <p className="text-sm text-muted">
                    {facility.a}
                    {facility.tel && ` ／ ${facility.tel}`}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}
