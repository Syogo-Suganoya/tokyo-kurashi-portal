/**
 * トップページ（ランディング）
 *
 * ここは「何ができるか」を伝える場所。実際に聞くのは `/chat`。
 * トップにも入力欄は置くが、送信するとチャット画面へ移る。
 *
 * 読み手はハッカソンの審査員ではなく、困りごとを抱えた住民として書く。
 * 「テーマ」「Tier」のような作り手の言葉は出さず、困りごとの言葉で並べる。
 *
 * **見出しで訴えるのは「困りごとが片づく」ことであって、AIとの違いではない。**
 * 住民はAIの作りに関心が無い。答えが返るかどうかにしか関心が無い。
 * 「AIは答えを書きません」は、正しさを気にする人のための**補足**として下の方に置く。
 */

import Link from 'next/link';

import { Contrast } from '@/components/Signpost';
import { CURATED_LINKS, getLink, type LinkId } from '@/data/links';
import { GOMI_MUNICIPALITY_COUNT } from '@/lib/gomi/search';

/**
 * 「こんなことが聞けます」の例。
 *
 * 分野の分類ではなく**住民が実際に口にする言葉**で並べる。
 * その場で答えるものと、公式のサービスへご案内するものを混ぜて並べ、
 * どちらであっても行き先があることを見せる。
 */
/** その場で答えられる4分野の画面 */
type ToolHref = '/gomi' | '/bouhan' | '/manabi' | '/barrierfree';

type Example =
  | { ask: string; answer: 'self'; href: ToolHref; label: string }
  | { ask: string; answer: 'guide'; linkId: LinkId };

const EXAMPLES: Example[] = [
  { ask: 'これ、燃えるごみ？', answer: 'self', href: '/gomi', label: 'ごみの分別' },
  { ask: '粗大ごみっていくらかかるの？', answer: 'self', href: '/gomi', label: 'ごみの分別' },
  {
    ask: '引っ越し先の治安を数字で比べたい',
    answer: 'self',
    href: '/bouhan',
    label: '町丁ごとの認知件数',
  },
  {
    ask: '子どもと行ける図書館や博物館は？',
    answer: 'self',
    href: '/manabi',
    label: '学びと体験の場',
  },
  {
    ask: '車椅子で入れるお店や駅を知りたい',
    answer: 'self',
    href: '/barrierfree',
    label: '車椅子で行ける場所',
  },
  { ask: '地震に備えて何を見ればいい？', answer: 'guide', linkId: 'tokyo-bousai' },
  { ask: '近くのAEDはどこ？', answer: 'guide', linkId: 'zenkoku-aed-map' },
  { ask: 'つらいとき、どこに相談すればいい？', answer: 'guide', linkId: 'mamorouyo-kokoro' },
  { ask: '暑い日に涼める場所はある？', answer: 'guide', linkId: 'tokyo-coolshare' },
  { ask: 'ボランティアを始めたい', answer: 'guide', linkId: 'tvac-volunteer' },
  { ask: '子どものことを相談したい', answer: 'guide', linkId: 'wakanavi-alpha' },
  { ask: 'こども食堂を探している', answer: 'guide', linkId: 'kodomo-shokudo-map' },
];

const CHAT_EXAMPLES = [
  'ペットボトルってどう捨てるの？',
  'アイロン台を捨てたい',
  '車椅子で入れるお店を探したい',
];

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-5xl px-5 pb-20">
      <header className="flex items-baseline justify-between gap-4 border-b border-line py-4">
        <p className="signboard text-base">くらしの道しるべ</p>
        <Link
          href="/chat"
          className="text-xs font-bold text-accent underline underline-offset-2 hover:no-underline"
        >
          困りごとを聞く →
        </Link>
      </header>

      {/* 入口 */}
      <section className="pt-12 sm:pt-16">
        <h1 className="signboard text-[clamp(2.25rem,7vw,4rem)]">
          くらしの「どうすればいい？」は、ぜんぶここから。
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed">
          ごみの分別も、引っ越し先の治安も、車椅子で入れるお店も。
          東京都のオープンデータから<strong>その場でお答えします</strong>。
          ここに答えが無いことは、それを扱っている公式のサービスへご案内します。
          <strong>行き先が無いまま終わることはありません。</strong>
        </p>

        {/* 入口。送信するとチャット画面へ移る */}
        <form
          action="/chat"
          method="get"
          className="mt-8 rounded-xl border border-line bg-surface p-5"
        >
          <label className="block text-sm font-semibold" htmlFor="q">
            困りごとを書いてください
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="q"
              name="q"
              type="search"
              placeholder="ペットボトルってどう捨てるの？"
              className="min-w-0 flex-1 rounded-lg border border-line bg-background px-3 py-2"
            />
            <button
              type="submit"
              className="rounded-lg bg-accent px-5 py-2 font-semibold text-surface"
            >
              聞く
            </button>
          </div>
          <p className="mt-3 text-sm text-muted">
            例：
            {CHAT_EXAMPLES.map((example, index) => (
              <span key={example}>
                {index > 0 && '、'}
                <Link
                  href={`/chat?q=${encodeURIComponent(example)}`}
                  className="underline underline-offset-2 hover:no-underline"
                >
                  {example}
                </Link>
              </span>
            ))}
          </p>
        </form>
      </section>

      {/* 聞けること */}
      <section id="examples" className="scroll-mt-4 pt-16">
        <p className="eyebrow text-muted">こんなことが聞けます</p>
        <h2 className="signboard mt-3 text-2xl">たとえば、こんな困りごと</h2>
        <p className="mt-2 max-w-2xl leading-relaxed text-muted">
          おおまかに12ほど例を挙げます。
          <strong className="text-foreground">その場でお答えするもの</strong>と、
          <strong className="text-foreground">扱っている公式のサービスへご案内するもの</strong>
          があります。どちらでも、行き先が無いまま終わることはありません。
        </p>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {EXAMPLES.map((example) => (
            <li key={example.ask} className="rounded-xl border border-line bg-surface p-4">
              <p className="signboard text-base">「{example.ask}」</p>
              {example.answer === 'self' ? (
                <Link
                  href={example.href}
                  className="mt-2 inline-block text-sm font-bold text-accent underline underline-offset-2 hover:no-underline"
                >
                  その場でお答えします（{example.label}）→
                </Link>
              ) : (
                <p className="mt-2 text-sm text-muted">
                  {getLink(example.linkId).org}「{getLink(example.linkId).name}」へご案内します
                </p>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted">
          ほかにも、税金の使いみち・都の手続き・観光・乗り換えなどのご案内先を用意しています。
          <Link href="#links" className="ml-1 underline underline-offset-2 hover:no-underline">
            ご案内先の一覧
          </Link>
        </p>
      </section>

      {/* よくあるAIチャットとの違い。関心のある人向けの補足として下に置く */}
      <section id="how" className="scroll-mt-4 pt-16">
        <p className="eyebrow text-muted">しくみ（補足）</p>
        <h2 className="signboard mt-3 text-2xl">よくあるAIチャットとの違い</h2>
        <p className="mt-2 max-w-2xl leading-relaxed text-muted">
          資料を検索してAIに要約させる作りとは、AIに任せる範囲の切り方が違います。
        </p>
        <div className="mt-5">
          <Contrast />
        </div>
      </section>

      {/* 送り先 */}
      <section id="links" className="scroll-mt-4 pt-16">
        <p className="eyebrow text-muted">ご案内先</p>
        <h2 className="signboard mt-3 text-2xl">ご案内する公式サービスの全部</h2>
        <p className="mt-2 max-w-2xl leading-relaxed text-muted">
          この{Object.keys(CURATED_LINKS).length}件がご案内先のすべてです。一件ずつ人が開いて確認しています。
          これに加えて、ごみ分別の{GOMI_MUNICIPALITY_COUNT}自治体ぶんのご案内先は、
          <strong className="text-foreground">
            東京都オープンデータカタログに各自治体が登録した公式ページを、更新のたびに疎通確認して
          </strong>
          使っています。どちらもAIがURLを作ることはないので、存在しないページへご案内することはありません。
        </p>
        <ul className="mt-5 grid gap-2 sm:grid-cols-2">
          {Object.entries(CURATED_LINKS).map(([id, link]) => (
            <li key={id}>
              <a
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="block rounded-lg border border-line bg-surface px-4 py-3 transition-colors hover:border-accent"
              >
                <p className="text-xs text-muted">{link.org}</p>
                <p className="mt-0.5 text-sm font-bold text-accent">
                  {link.name} <span aria-hidden>↗</span>
                </p>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <footer className="mt-16 border-t border-line pt-6">
        <Link
          href="/chat"
          className="inline-block rounded-lg bg-accent px-5 py-2 font-semibold text-surface"
        >
          困りごとを聞いてみる →
        </Link>
        <p className="mt-5 text-sm leading-relaxed text-muted">
          答えの本文は行政が公開したオープンデータそのものです。
          申請・予約・申込みといった、あなたに責任が生じる手続きは代行せず、必ず公式の窓口へご案内します。
        </p>
      </footer>
    </div>
  );
}
