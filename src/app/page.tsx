/**
 * トップページ
 *
 * 主張を先に置く構成にしている。
 * 「AIは答えを書かない」というのがこのサービスの設計そのものであり、
 * 検索して要約させる作りのAIチャットとの違いもそこにしか無いため、
 * それを見出しと図版で最初に出し、あとから実物（チャットと簡易版4本）に案内する。
 *
 * 作らないと決めたテーマ（設計書 §2 のTier分類）と、送り先の一覧も画面に出す。
 * 何を持っていないかを見せることまで含めて、このサービスの説明になる。
 */

import Link from 'next/link';

import { Chat } from '@/components/Chat';
import { Pictogram, type ToolIcon } from '@/components/Pictogram';
import { AnswerPath, Contrast } from '@/components/Signpost';
import { CURATED_LINKS, getLink } from '@/data/links';
import { TOPIC_LINKS, type KnownTopic } from '@/lib/ai/tools';
import { BARRIERFREE_ORGS, BARRIERFREE_TOTAL } from '@/lib/barrierfree/search';
import { BOUHAN_AREA_COUNT, BOUHAN_YEAR } from '@/lib/bouhan/search';
import { GOMI_ITEM_COUNT, GOMI_MUNICIPALITY_COUNT } from '@/lib/gomi/search';
import { MANABI_FACILITY_COUNT } from '@/lib/manabi/search';

type Tool = {
  href: '/gomi' | '/bouhan' | '/manabi' | '/barrierfree';
  icon: ToolIcon;
  color: string;
  title: string;
  figure: string;
  unit: string;
  body: string;
  /** その簡易版が既存サービスに対して何を足しているか */
  edge: string;
};

const TOOLS: Tool[] = [
  {
    href: '/gomi',
    icon: 'gomi',
    color: 'var(--route-gomi)',
    title: 'ごみの分別',
    figure: GOMI_ITEM_COUNT.toLocaleString(),
    unit: `品目 / ${GOMI_MUNICIPALITY_COUNT}自治体`,
    body: '品目名を入れると、その自治体の公式表記のまま分別区分・注意点・粗大ごみ料金が出ます。',
    edge: `区市町村ごとに別サイトの公式チャットボットを、${GOMI_MUNICIPALITY_COUNT}自治体ぶん同じ画面で引けます。`,
  },
  {
    href: '/bouhan',
    icon: 'bouhan',
    color: 'var(--route-bouhan)',
    title: '町丁ごとの犯罪認知件数',
    figure: BOUHAN_AREA_COUNT.toLocaleString(),
    unit: `町丁 / ${BOUHAN_YEAR}`,
    body: '2つ入力すると並べて比べられます。何の手口でその件数になっているかを必ず併せて出します。',
    edge: '地図中心の既存マップではしにくい、引っ越し先候補の数値比較に振り切っています。',
  },
  {
    href: '/manabi',
    icon: 'manabi',
    color: 'var(--route-manabi)',
    title: '学びと体験の場',
    figure: MANABI_FACILITY_COUNT.toLocaleString(),
    unit: '施設 / 9種別',
    body: '図書館・博物館・公民館・青少年施設などを1つの地図に統合しました。',
    edge: '種別ごとにサイトが分かれている現状を、種別をまたいで一望できます。',
  },
  {
    href: '/barrierfree',
    icon: 'barrierfree',
    color: 'var(--route-barrierfree)',
    title: '車椅子で行ける場所',
    figure: BARRIERFREE_TOTAL.toLocaleString(),
    unit: `か所 / ${BARRIERFREE_ORGS.length}局`,
    body: '飲食店・鉄道駅・公共施設を、必要な設備の条件で絞り込めます。',
    edge: '3つの局が別々に公開しているデータを、行けるかどうかの1軸に束ねています。',
  },
];

/**
 * 設計書 §10 の12テーマ。**どのテーマにも受け皿があることを画面で示す。**
 * 自前で答えるものは `tools`、既存へ送るものは `topic`（キュレーションDBのIDはそこから引く）。
 * 受け皿の無いテーマを作らないことが、このサービスの約束そのものなので一覧で見せる。
 */
type Theme = {
  no: number;
  name: string;
  tier: 'A' | 'B' | 'C' | 'D';
  /** 自前で答える簡易版 */
  tools?: { label: string; href: Tool['href'] }[];
  /** 既存サービスへ送る場合の分野キー */
  topic?: KnownTopic;
};

const THEMES: Theme[] = [
  { no: 1, name: '防災', tier: 'C', topic: 'bousai' },
  { no: 2, name: '防犯', tier: 'A', tools: [{ label: '認知件数', href: '/bouhan' }], topic: 'bouhan' },
  { no: 3, name: '健康・医療', tier: 'C', topic: 'kenko' },
  { no: 4, name: '環境（ごみ）', tier: 'B', tools: [{ label: 'ごみの分別', href: '/gomi' }] },
  { no: 5, name: '気候変動', tier: 'D', topic: 'kikou' },
  { no: 6, name: '生活（税金・支援）', tier: 'D', topic: 'zeikin' },
  { no: 7, name: '社会参加', tier: 'D', topic: 'shakai' },
  {
    no: 8,
    name: '子ども・若者',
    tier: 'A',
    tools: [{ label: '学びと体験の場', href: '/manabi' }],
    topic: 'kodomo',
  },
  {
    no: 9,
    name: '福祉',
    tier: 'A',
    tools: [{ label: '車椅子で行ける場所', href: '/barrierfree' }],
    topic: 'fukushi',
  },
  { no: 10, name: 'デジタル', tier: 'D', topic: 'digital' },
  {
    no: 11,
    name: '交通',
    tier: 'A',
    tools: [{ label: '駅のバリアフリー', href: '/barrierfree' }],
    topic: 'kotsu',
  },
  { no: 12, name: '観光', tier: 'D', topic: 'kanko' },
];

const TIER_MEANING: Record<Theme['tier'], string> = {
  A: '都全域のデータがある',
  B: '自治体別だが標準スキーマ',
  C: 'スキーマがバラバラ',
  D: '生データが無い／既存が優秀',
};

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-5xl px-5 pb-20">
      <header className="flex items-baseline justify-between gap-4 border-b border-line py-4">
        <p className="signboard text-base">くらしの道しるべ</p>
        <p className="text-xs text-muted">東京都オープンデータ活用ポータル</p>
      </header>

      {/* 主張 */}
      <section className="pt-12 sm:pt-16">
        <p className="eyebrow text-accent">AIチャットとの違い</p>
        <h1 className="signboard mt-4 text-[clamp(2.25rem,7vw,4rem)]">AIは、答えを書きません。</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed">
          答えるのは東京都のオープンデータそのものです。
          AIがするのは、あなたの困りごとがどの分野かを判定して、必要な言葉を取り出すことだけ。
          <strong>分別区分も件数も施設名も、AIが作る経路はありません。</strong>
        </p>
        <div className="mt-8">
          <AnswerPath />
        </div>
      </section>

      {/* 実物 */}
      <section id="try" className="scroll-mt-4 pt-16">
        <p className="eyebrow text-muted">試す</p>
        <h2 className="signboard mt-3 text-2xl">困りごとを書いてください</h2>
        <p className="mt-2 max-w-2xl leading-relaxed text-muted">
          どの分野か判定して、下の4つのうち答えを持っているものが返します。
          持っていない分野は、担当している公式サービスをご案内します。
        </p>
        <div className="mt-5">
          <Chat />
        </div>
      </section>

      {/* 簡易版4本 */}
      <section id="tools" className="scroll-mt-4 pt-16">
        <p className="eyebrow text-muted">自前で答えを持っている4つ</p>
        <h2 className="signboard mt-3 text-2xl">チャットを使わずに直接ひらく</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {TOOLS.map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              className="relative overflow-hidden rounded-xl border border-line bg-surface p-5 pl-6 transition-colors hover:border-accent"
            >
              {/* 分野の色帯。装飾ではなく見分けるための印 */}
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 w-1.5"
                style={{ background: tool.color }}
              />
              <div className="flex items-start gap-3">
                <span style={{ color: tool.color }}>
                  <Pictogram name={tool.icon} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="signboard text-lg">{tool.title}</p>
                  <p className="mt-2">
                    <span className="figure text-3xl font-bold" style={{ color: tool.color }}>
                      {tool.figure}
                    </span>
                    <span className="ml-2 text-xs text-muted">{tool.unit}</span>
                  </p>
                </div>
              </div>
              <p className="mt-3 text-sm leading-relaxed">{tool.body}</p>
              <p className="mt-2 border-t border-line pt-2 text-xs leading-relaxed text-muted">
                {tool.edge}
              </p>
              <p className="mt-3 text-sm font-bold text-accent">ひらく →</p>
            </Link>
          ))}
        </div>
      </section>

      {/* 対比 */}
      <section id="compare" className="scroll-mt-4 pt-16">
        <p className="eyebrow text-muted">くらべる</p>
        <h2 className="signboard mt-3 text-2xl">どこが違うのか</h2>
        <p className="mt-2 max-w-2xl leading-relaxed text-muted">
          行政の情報を扱うので、正しさを人が担保できる形にしています。
          そのために、AIに任せる範囲をどこで切ったかが違いになります。
        </p>
        <div className="mt-5">
          <Contrast />
        </div>
      </section>

      {/* 12テーマの網羅状況 */}
      <section id="scope" className="scroll-mt-4 pt-16">
        <p className="eyebrow text-muted">カバー範囲</p>
        <h2 className="signboard mt-3 text-2xl">12のテーマ全部に受け皿があります</h2>
        <p className="mt-2 max-w-2xl leading-relaxed text-muted">
          全部を自前では作りません。東京都オープンデータカタログを実際に調べ、データの入手しやすさで
          テーマを4段階に分け、
          <strong className="text-foreground">データがあって横断に価値がある領域だけを自前で持ちます</strong>
          。作らないと決めたテーマも、担当している既存サービスへ必ず送ります。
        </p>
        <div className="mt-5 overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[44rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="px-4 py-3 font-bold">テーマ</th>
                <th className="px-4 py-3 font-bold">データの入手しやすさ</th>
                <th className="px-4 py-3 font-bold">このサービスの対応</th>
              </tr>
            </thead>
            <tbody>
              {THEMES.map((theme) => (
                <tr key={theme.no} className="border-b border-line align-top last:border-b-0">
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="figure mr-2 text-muted">{theme.no}</span>
                    <span className="font-bold">{theme.name}</span>
                  </td>
                  <td className="px-4 py-3 leading-relaxed text-muted">
                    <span className="figure mr-2 font-bold text-foreground">{theme.tier}</span>
                    {TIER_MEANING[theme.tier]}
                  </td>
                  <td className="px-4 py-3 leading-relaxed">
                    {theme.tools?.map((tool) => (
                      <Link
                        key={tool.label}
                        href={tool.href}
                        className="mr-2 inline-block rounded bg-accent-soft px-2 py-0.5 text-xs font-bold text-accent underline underline-offset-2 hover:no-underline"
                      >
                        自前で答える：{tool.label}
                      </Link>
                    ))}
                    {theme.topic && (
                      <span className="text-muted">
                        {theme.tools ? 'それ以外は' : ''}
                        {TOPIC_LINKS[theme.topic].linkIds
                          .map((id) => getLink(id).name)
                          .join('、')}
                        へ送ります
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 送り先 */}
      <section id="links" className="scroll-mt-4 pt-16">
        <p className="eyebrow text-muted">送り先</p>
        <h2 className="signboard mt-3 text-2xl">ご案内する公式サービスの全部</h2>
        <p className="mt-2 max-w-2xl leading-relaxed text-muted">
          分野ごとのご案内先は、この{Object.keys(CURATED_LINKS).length}件がすべてです。一件ずつ人が開いて確認しています。
          これに加えて、ごみ分別の{GOMI_MUNICIPALITY_COUNT}自治体ぶんの案内先は、
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

      <footer className="mt-16 border-t border-line pt-6 text-sm leading-relaxed text-muted">
        <p>
          答えの本文は行政が公開したオープンデータそのものです。
          申請・予約・申込みといった、住民に責任が発生する手続きは代行せず、必ず公式の窓口へご案内します。
        </p>
      </footer>
    </div>
  );
}
