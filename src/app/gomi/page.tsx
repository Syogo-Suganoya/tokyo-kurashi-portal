/**
 * ごみ分別 簡易版 `/gomi`（設計書 §3.1）
 *
 * 検索はサーバ側で実行し、結果はクエリ文字列に載せる（`/gomi?m=tachikawa&q=アイロン台`）。
 * 640KBの分別データをブラウザに送らずに済み、JavaScriptが無くても動き、
 * 検索結果のURLをそのまま共有できる。行政情報を扱う画面としてはこの方が素直。
 */

import Link from 'next/link';

import { AnswerCard } from '@/components/AnswerCard';
import { SkipToAnswer } from '@/components/SkipToAnswer';
import { Pictogram } from '@/components/Pictogram';
import { SavedMunicipalityLinks } from '@/components/SavedMunicipalityLinks';
import { MUNICIPALITIES } from '@/data/municipalities';
import { searchGomi } from '@/lib/gomi/search';

export const metadata = {
  title: 'ごみの分別を調べる｜くらしの道しるべ',
};

const EXAMPLES = ['ペットボトル', 'アイロン台', '乾電池', 'スプレー缶'];

export default async function GomiPage({ searchParams }: PageProps<'/gomi'>) {
  const params = await searchParams;
  const municipality = typeof params.m === 'string' ? params.m : '';
  const query = typeof params.q === 'string' ? params.q : '';
  const submitted = municipality !== '';

  const result = submitted ? searchGomi({ item: query, municipality }) : null;

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10">
      <p className="text-sm">
        <Link href="/" className="text-muted underline underline-offset-2 hover:no-underline">
          くらしの道しるべ
        </Link>
      </p>
      <h1 className="signboard mt-2 text-3xl">ごみの分別を調べる</h1>
      {result && <SkipToAnswer />}
      <p className="mt-3 leading-relaxed text-muted">
        東京都オープンデータから取り込んだ分別データで、その場でお答えします。
        分別区分は<strong className="text-foreground">自治体の公式表記のまま</strong>
        表示します（ごみ袋やカレンダーの表記と食い違わないようにするためです）。
      </p>

      <SavedMunicipalityLinks current={municipality} />

      <form method="get" className="mt-5 rounded-xl border border-line bg-surface p-5">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,12rem)_1fr]">
          <label className="block">
            <span className="text-sm font-semibold">お住まいの区市町村</span>
            <select
              name="m"
              defaultValue={municipality}
              className="mt-1 w-full rounded-lg border border-line bg-background px-3 py-2"
            >
              <option value="">選択してください</option>
              {MUNICIPALITIES.map((m) => (
                <option key={m.code} value={m.code}>
                  {m.name}
                  {m.supported ? '' : '（未対応）'}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-semibold">捨てたいもの</span>
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="ペットボトル"
              className="mt-1 w-full rounded-lg border border-line bg-background px-3 py-2"
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            className="rounded-lg bg-accent px-5 py-2 font-semibold text-surface"
          >
            調べる
          </button>
          <span className="text-sm text-muted">
            例：
            {EXAMPLES.map((example, index) => (
              <span key={example}>
                {index > 0 && '、'}
                <Link
                  href={`/gomi?m=${municipality || 'tachikawa'}&q=${encodeURIComponent(example)}`}
                  className="underline underline-offset-2 hover:no-underline"
                >
                  {example}
                </Link>
              </span>
            ))}
          </span>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          未対応の区市町村もあえて選べるようにしています。選ぶと、
          <strong className="text-foreground">なぜ対応できていないのか</strong>
          をお伝えした上で、その区市町村の公式ページへご案内します。
        </p>
      </form>

      {result && (
        <div id="answer" tabIndex={-1} className="mt-8">
          <AnswerCard result={result} />

          {result.alternatives.length > 0 && (
            <section className="mt-4 rounded-xl border border-line bg-surface p-5">
              <h2 className="eyebrow text-muted">
                同じ言葉で見つかった他の品目
              </h2>
              <ul className="mt-3 space-y-2 text-sm">
                {result.alternatives.map((alternative) => (
                  <li key={alternative.name} className="flex items-baseline gap-2">
                    <Pictogram name={alternative.icon} className="h-5 w-5 shrink-0 text-accent" />
                    <span className="font-medium">{alternative.name}</span>
                    <span className="text-muted">{alternative.category}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </main>
  );
}
