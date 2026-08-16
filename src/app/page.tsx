/**
 * トップページ
 *
 * AIチャットはまだ載せていないので、`/gomi` への導線と、
 * 「どのテーマを自前で持ち、どれを既存サービスに委ねたか」の判断（設計書 §2 のTier分類）を出す。
 * この判断そのものを画面に出すこと自体が設計の主張（設計書 §2.3）。
 */

import Link from 'next/link';

import { Chat } from '@/components/Chat';

type TierRow = {
  tier: 'A' | 'B' | 'C' | 'D';
  meaning: string;
  themes: string;
  stance: string;
  built?: boolean;
};

const TIERS: TierRow[] = [
  {
    tier: 'A',
    meaning: '都全域の一括データがある',
    themes: '防犯 / 学び・体験 / バリアフリー',
    stance: '自前の簡易版で答える（防犯のみ実装済み）',
    built: true,
  },
  {
    tier: 'B',
    meaning: '自治体別だが国の推奨データセット標準スキーマに準拠',
    themes: 'ごみ分別',
    stance: '自前の簡易版で答える',
    built: true,
  },
  {
    tier: 'C',
    meaning: '自治体別かつスキーマがバラバラ。名寄せコストが見合わない',
    themes: '避難所 / AED / こども食堂 / 保育所 / 公衆トイレ',
    stance: '作らない。優れた既存サービスへ送る',
  },
  {
    tier: 'D',
    meaning: '有用な生データが無い、または既存の完成度が高い',
    themes: '税金 / 観光 / デジタル / 社会参加 / 気候変動',
    stance: '作らない。既存の劣化版にしかならないため',
  },
];

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-12">
      <h1 className="text-4xl font-bold">くらしの道しるべ</h1>
      <p className="mt-4 text-lg leading-relaxed">
        生活の困りごとに、東京都のオープンデータから
        <strong>その場で答えを返します</strong>。
        答えられない部分は、その限界をはっきり書いた上で公式サービスへご案内します。
      </p>

      <section className="mt-10">
        <Chat />
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold text-muted">チャットを使わずに調べる</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Link
            href="/gomi"
            className="block rounded-xl border border-line bg-surface p-6 transition-colors hover:border-accent"
          >
            <p className="text-xl font-bold">ごみの分別を調べる</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              立川市・中野区に対応。品目名を入れると、その自治体の公式表記のまま分別区分・注意点・
              粗大ごみ料金をお答えします。未対応の区市町村は公式ページへご案内します。
            </p>
            <p className="mt-3 text-sm font-semibold text-accent">調べる →</p>
          </Link>
          <Link
            href="/bouhan"
            className="block rounded-xl border border-line bg-surface p-6 transition-colors hover:border-accent"
          >
            <p className="text-xl font-bold">町丁ごとの犯罪認知件数を調べる</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              都内5,132町丁に対応。2つ入力すると並べて比べられます。件数の多さは危険さを意味しないため、
              何の手口でその件数になっているかを必ず併せて表示します。
            </p>
            <p className="mt-3 text-sm font-semibold text-accent">調べる →</p>
          </Link>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-bold">どのテーマを自前で持ち、どれを既存に委ねたか</h2>
        <p className="mt-3 leading-relaxed text-muted">
          全テーマで無理に自作はしません。東京都オープンデータカタログを実際に検索し、
          データの入手性でテーマを4段階に分けた上で、
          <strong className="text-foreground">
            データがあり横断に価値がある領域だけを自前で持ちます
          </strong>
          。
        </p>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="py-2 pr-3 font-semibold">Tier</th>
                <th className="py-2 pr-3 font-semibold">データの入手性</th>
                <th className="py-2 pr-3 font-semibold">テーマ</th>
                <th className="py-2 font-semibold">方針</th>
              </tr>
            </thead>
            <tbody>
              {TIERS.map((row) => (
                <tr key={row.tier} className="border-b border-line align-top">
                  <td className="py-3 pr-3 font-bold">{row.tier}</td>
                  <td className="py-3 pr-3 leading-relaxed text-muted">{row.meaning}</td>
                  <td className="py-3 pr-3 leading-relaxed">{row.themes}</td>
                  <td className="py-3 leading-relaxed">
                    {row.stance}
                    {row.built && (
                      <span className="ml-2 inline-block rounded bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">
                        実装済み
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-12 rounded-xl border border-line bg-surface p-6">
        <h2 className="text-lg font-bold">答えの出し方について</h2>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed">
          <li>
            答えの本文は、行政が公開したオープンデータそのものです。生成AIが分別区分や数値を作ることはありません。
          </li>
          <li>
            ご案内する公式サービスのURLは、あらかじめ人が確認した一覧の中からのみ選ばれます。存在しない行政URLを表示することはありません。
          </li>
          <li>
            申請・予約・申込みといった、住民に責任が発生する手続きは代行しません。必ず公式の窓口へご案内します。
          </li>
        </ul>
      </section>
    </main>
  );
}
