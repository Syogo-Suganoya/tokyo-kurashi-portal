/**
 * 共通画面契約の描画（設計書 §3）
 *
 * 簡易版4本すべてがこの1コンポーネントを通る。個別に作り込まない。
 * ①答え ②出典・時点・カバー範囲 ③できないこと ④公式への引き継ぎ を必ず全部描く。
 * ②〜④を描かない分岐はここに作らないこと。作った時点で共通契約が意味を失う。
 */

import { Pictogram } from '@/components/Pictogram';
import { getLink } from '@/data/links';
import {
  ESCALATION_LABEL,
  type AnswerResult,
  type Escalation,
  type EscalationKind,
} from '@/types/answer';

/** 住民にとって行動につながる順に並べる。鮮度は最後 */
const ESCALATION_ORDER: Record<EscalationKind, number> = {
  out_of_scope: 0,
  procedure: 1,
  deep_dive: 2,
  freshness: 3,
};

const ESCALATION_STYLE: Record<EscalationKind, string> = {
  out_of_scope: 'bg-warn-soft text-warn',
  procedure: 'bg-warn-soft text-warn',
  deep_dive: 'bg-accent-soft text-accent',
  freshness: 'bg-accent-soft text-accent',
};

export function AnswerCard({ result }: { result: AnswerResult }) {
  const escalations = [...result.escalations].sort(
    (a, b) => ESCALATION_ORDER[a.kind] - ESCALATION_ORDER[b.kind],
  );

  return (
    <article className="overflow-hidden rounded-xl border border-line bg-surface">
      {/* ① 答え */}
      {result.answer ? (
        <div className="border-b border-line p-6">
          <p className="text-sm text-muted">{result.answer.subject}</p>
          {/*
            答えは見出しにする。読み上げで見出しを辿る人が、**最初に答えに着く**ようにするため。
            ここが段落のままだと、この画面で一番重要な文が見出しの一覧に出てこない。
          */}
          <h2 className="mt-2 flex items-center gap-3 text-3xl font-bold">
            <Pictogram name={result.answer.icon} className="h-9 w-9 shrink-0 text-accent" />
            <span>{result.answer.headline}</span>
          </h2>
          {result.answer.facts.length > 0 && (
            <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2">
              {result.answer.facts.map((fact) => (
                <div key={fact.label}>
                  <dt className="text-xs text-muted">{fact.label}</dt>
                  <dd className="text-lg font-semibold">{fact.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {result.answer.note && (
            <p className="mt-4 rounded-lg bg-background p-3 text-sm leading-relaxed">
              {result.answer.note}
            </p>
          )}
        </div>
      ) : (
        <div className="border-b border-line p-6">
          <h2 className="text-xl font-bold">{result.headline}</h2>
        </div>
      )}

      {/* ② 出典・時点・カバー範囲 */}
      <dl className="grid gap-2 border-b border-line px-6 py-4 text-sm sm:grid-cols-[6rem_1fr]">
        <dt className="text-muted">出典</dt>
        <dd>
          <a
            className="underline underline-offset-2 hover:no-underline"
            href={result.provenance.sourceUrl}
            target="_blank"
            rel="noreferrer"
          >
            {result.provenance.sourceName}
          </a>
        </dd>
        <dt className="text-muted">時点</dt>
        <dd>{result.provenance.asOf}</dd>
        <dt className="text-muted">カバー範囲</dt>
        <dd>{result.provenance.coverage}</dd>
      </dl>

      {/* ③ この簡易版でできないこと */}
      <section className="border-b border-line px-6 py-4">
        <h3 className="text-sm font-semibold text-warn">この画面で分からないこと</h3>
        <ul className="mt-2 space-y-1 text-sm leading-relaxed">
          {result.limitations.map((limitation) => (
            <li key={limitation} className="flex gap-2">
              <span aria-hidden className="text-muted">
                •
              </span>
              <span>{limitation}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* ④ 公式サービスへ */}
      <section className="px-6 py-4">
        <h3 className="text-sm font-semibold text-muted">公式サービスで続けられます</h3>
        <ul className="mt-3 space-y-3">
          {escalations.map((escalation) => (
            <EscalationRow key={`${escalation.kind}-${escalation.linkId ?? escalation.link.url}`} escalation={escalation} />
          ))}
        </ul>
      </section>
    </article>
  );
}

function EscalationRow({ escalation }: { escalation: Escalation }) {
  // キュレーションDBのIDか、取り込み時に疎通確認したリンクのどちらか。どちらもAIは触らない
  const link = escalation.linkId ? getLink(escalation.linkId) : escalation.link;
  return (
    <li className="rounded-lg border border-line p-3">
      <span
        className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${ESCALATION_STYLE[escalation.kind]}`}
      >
        {ESCALATION_LABEL[escalation.kind]}
      </span>
      <p className="mt-2 text-sm leading-relaxed">{escalation.reason}</p>
      <a
        className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-accent underline underline-offset-2 hover:no-underline"
        href={link.url}
        target="_blank"
        rel="noreferrer"
      >
        {link.org}「{link.name}」<span aria-hidden>↗</span>
      </a>
    </li>
  );
}
