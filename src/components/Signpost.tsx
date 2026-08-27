/**
 * 案内標識の語彙で作った図版一式。
 *
 * このサービスの主張は「AIは答えを書かない。送り先を決めるだけ」なので、
 * 図でも **AIを箱（答えが生まれる場所）ではなく矢印（送る働き）として描く**。
 * 箱に入っているのは行政のオープンデータと公式サービスだけになり、
 * どこから答えが来るのかが図の構造そのもので分かる。
 */

/** 太い矢印。横並びのときは右向き、縦積みのときは下向きになる */
function Arrow({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 24"
      aria-hidden
      className={`h-6 w-12 rotate-90 sm:rotate-0 ${className}`}
      fill="none"
    >
      <path
        d="M2 12h38M32 4l10 8-10 8"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Station({
  label,
  title,
  body,
  tone = 'plain',
}: {
  label: string;
  title: string;
  body: string;
  tone?: 'plain' | 'primary';
}) {
  const primary = tone === 'primary';
  return (
    <div
      className={`flex-1 basis-0 rounded-lg border p-4 ${
        primary ? 'border-transparent bg-accent text-surface' : 'border-line bg-surface'
      }`}
    >
      <p className={`eyebrow ${primary ? 'opacity-80' : 'text-muted'}`}>{label}</p>
      <p className="signboard mt-2 text-balance text-lg">{title}</p>
      <p className={`mt-1.5 text-sm leading-relaxed ${primary ? 'opacity-90' : 'text-muted'}`}>
        {body}
      </p>
    </div>
  );
}

/** 矢印の上に置く役割の注記。AIの仕事はここにしか出てこない */
function Leg({ note, sub }: { note: string; sub: string }) {
  return (
    <div className="flex shrink-0 flex-col items-center gap-1 py-2 sm:w-32 sm:py-0">
      <p className="text-center text-xs font-bold text-accent">{note}</p>
      <Arrow className="text-accent" />
      <p className="text-center text-[0.6875rem] leading-snug text-muted">{sub}</p>
    </div>
  );
}

/** 署名となる図版。答えがどこから来るのかを示す */
export function AnswerPath() {
  return (
    <figure className="rounded-xl border border-line bg-background p-4 sm:p-6">
      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
        <Station
          label="入口"
          title="あなたの困りごと"
          body="「ペットボトルってどう捨てるの？」のように、そのままの言葉で。"
        />
        <Leg note="AIが分野を判定" sub="AIが触るのはここだけ" />
        <Station
          tone="primary"
          label="答え"
          title="東京都のオープンデータ"
          body="行政が公開した値をそのまま表示します。AIは文章を書きません。"
        />
        <Leg note="足りない分だけ" sub="限界を書いてから" />
        <Station
          label="出口"
          title="行政の公式サービス"
          body="申請・予約・地図など、ここで扱えないことは公式へ。"
        />
      </div>
      <figcaption className="mt-4 border-t border-line pt-3 text-sm leading-relaxed">
        <strong className="signboard text-base">AIは矢印です。箱ではありません。</strong>
        <span className="ml-2 text-muted">
          答えが入っている箱は、行政のオープンデータと公式サービスだけです。
        </span>
      </figcaption>
    </figure>
  );
}

type Row = { step: string; common: string; ours: string; ourStrong?: boolean };

const ROWS: Row[] = [
  {
    step: '答えられないとき',
    common: '推測で埋めるか、曖昧に濁す',
    ours: 'できないことを書き、担当する公式サービスへ送る',
    ourStrong: true,
  },
];

/** よくあるAIチャット（検索して要約させる作り）との違い */
export function Contrast() {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="grid grid-cols-1 gap-px bg-line sm:grid-cols-[10rem_1fr_1fr]">
        <div className="hidden bg-surface p-3 sm:block" />
        <div className="bg-surface p-3">
          <p className="eyebrow text-muted">よくあるAIチャット</p>
          <p className="mt-1 text-sm text-muted">資料を検索してAIに要約させる作り</p>
        </div>
        <div className="bg-accent-soft p-3">
          <p className="eyebrow text-accent">くらしの道しるべ</p>
          <p className="mt-1 text-sm">AIは送り先を決めるだけの作り</p>
        </div>

        {ROWS.map((row) => (
          <div key={row.step} className="contents">
            <div className="bg-surface px-3 pt-3 sm:py-3">
              <p className="signboard text-sm">{row.step}</p>
            </div>
            <div className="bg-surface px-3 pb-2 sm:py-3">
              <p className="text-sm leading-relaxed text-muted">{row.common}</p>
            </div>
            <div className="bg-accent-soft px-3 pb-3 sm:py-3">
              <p
                className={`text-sm leading-relaxed ${row.ourStrong ? 'font-bold text-accent' : ''}`}
              >
                {row.ours}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
