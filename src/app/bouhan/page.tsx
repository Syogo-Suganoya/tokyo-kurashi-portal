/**
 * 防犯 簡易版 `/bouhan`（設計書 §3.2）
 *
 * 既存の警視庁マップ・都の防犯マップは地図表示が主で、
 * 「引っ越し先候補2つを数字で比べる」ことがしにくい。ここは町丁単位の数値比較に振り切る。
 * そのため入力欄を2つ持ち、2町丁を並べて表示できるようにしている。
 */

import Link from 'next/link';

import { AnswerCard } from '@/components/AnswerCard';
import { searchBouhan } from '@/lib/bouhan/search';

export const metadata = {
  title: '町丁ごとの犯罪認知件数を調べる｜くらしの道しるべ',
};

const EXAMPLES = [
  { a: '丸の内１丁目', b: '' },
  { a: '西新宿７丁目', b: '荻窪５丁目' },
];

export default async function BouhanPage({ searchParams }: PageProps<'/bouhan'>) {
  const params = await searchParams;
  const first = typeof params.a === 'string' ? params.a : '';
  const second = typeof params.b === 'string' ? params.b : '';

  const results = [first, second]
    .filter((area) => area.trim() !== '')
    .map((area) => ({ area, result: searchBouhan({ area }) }));

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10">
      <p className="text-sm">
        <Link href="/" className="text-muted underline underline-offset-2 hover:no-underline">
          くらしの道しるべ
        </Link>
      </p>
      <h1 className="signboard mt-2 text-3xl">町丁ごとの犯罪認知件数を調べる</h1>
      <p className="mt-3 max-w-3xl leading-relaxed text-muted">
        警視庁が公開している町丁別の認知件数を、そのまま数字でお見せします。
        2つ入力すると並べて比べられます。
        <strong className="text-foreground">
          件数の多さは、その町丁が危険であることを意味しません
        </strong>
        。駅や商業施設のある町丁は、そこで働く人・訪れる人の分だけ件数が増えます。
      </p>

      <form method="get" className="mt-8 rounded-xl border border-line bg-surface p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-semibold">町丁名または区市町村名</span>
            <input
              type="search"
              name="a"
              defaultValue={first}
              placeholder="丸の内１丁目"
              className="mt-1 w-full rounded-lg border border-line bg-background px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold">比べたい町丁（任意）</span>
            <input
              type="search"
              name="b"
              defaultValue={second}
              placeholder="荻窪５丁目"
              className="mt-1 w-full rounded-lg border border-line bg-background px-3 py-2"
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="submit" className="rounded-lg bg-accent px-5 py-2 font-semibold text-surface">
            調べる
          </button>
          <span className="text-sm text-muted">
            例：
            {EXAMPLES.map((example, index) => (
              <span key={example.a}>
                {index > 0 && '、'}
                <Link
                  href={`/bouhan?a=${encodeURIComponent(example.a)}&b=${encodeURIComponent(example.b)}`}
                  className="underline underline-offset-2 hover:no-underline"
                >
                  {example.a}
                  {example.b && ` と ${example.b}`}
                </Link>
              </span>
            ))}
          </span>
        </div>
      </form>

      {results.length > 0 && (
        <div className={`mt-8 grid gap-6 ${results.length > 1 ? 'lg:grid-cols-2' : ''}`}>
          {results.map(({ area, result }) => (
            <div key={area}>
              <AnswerCard result={result} />
              {result.alternatives.length > 0 && (
                <section className="mt-4 rounded-xl border border-line bg-surface p-5">
                  <h2 className="eyebrow text-muted">
                    同じ言葉で見つかった他の町丁
                  </h2>
                  <ul className="mt-3 space-y-2 text-sm">
                    {result.alternatives.map((alternative) => (
                      <li key={alternative.name} className="flex justify-between gap-3">
                        <Link
                          href={`/bouhan?a=${encodeURIComponent(alternative.name)}`}
                          className="underline underline-offset-2 hover:no-underline"
                        >
                          {alternative.name}
                        </Link>
                        <span className="shrink-0 text-muted">
                          {alternative.total.toLocaleString()}件
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
