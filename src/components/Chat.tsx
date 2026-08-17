'use client';

/**
 * 困りごとチャット（設計書 §6-1）
 *
 * 自然文を投げると、AIが呼ぶツールを決め、簡易版が答えを返す。
 * 答えは `/gomi` と同じ AnswerCard で描く。共通画面契約は経路が変わっても同じ（設計書 §3）。
 */

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { AnswerCard } from '@/components/AnswerCard';
import { MUNICIPALITIES } from '@/data/municipalities';
import type { ChatResponse } from '@/app/api/chat/route';

const EXAMPLES = [
  'ペットボトルってどう捨てるの？',
  'アイロン台を捨てたい',
  '西新宿７丁目の治安が知りたい',
  '車椅子で入れるお店を探したい',
  '近くのAEDを探したい',
];

type Turn = { question: string; response: ChatResponse };

export function Chat({ initialQuestion = '' }: { initialQuestion?: string }) {
  const [input, setInput] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pending, setPending] = useState(false);
  // 一度答えてもらった自治体はセッション中は保持し、以降は聞き返さない（設計書 §4.3）
  const [municipality, setMunicipality] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  /** トップから渡された質問を一度だけ送る。開発時の再マウントで二重送信しないよう見張る */
  const sentInitial = useRef(false);

  async function ask(question: string, withMunicipality = municipality) {
    if (!question.trim() || pending) return;
    setPending(true);
    setInput('');
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: question, municipality: withMunicipality }),
      });
      const response = (await res.json()) as ChatResponse;
      setTurns((prev) => [...prev, { question, response }]);
    } catch {
      setTurns((prev) => [
        ...prev,
        { question, response: { type: 'error', message: '通信に失敗しました。もう一度お試しください。' } },
      ]);
    } finally {
      setPending(false);
      inputRef.current?.focus();
    }
  }

  // トップページのフォームから来たときは、その質問をそのまま投げる
  useEffect(() => {
    if (!initialQuestion || sentInitial.current) return;
    sentInitial.current = true;
    void ask(initialQuestion);
    // ask は毎レンダリング作り直されるので依存に入れない。初回だけ動かすのが目的
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion]);

  /**
   * 聞き返しに答えたら、その自治体を覚えて**元の質問文のまま**やり直す。
   * 抽出済みの品目名だけを送り直すと、「ペットボトル」のような裸の単語になり、
   * フォールバックのキーワード判定が「ごみの質問」と認識できなくなる。
   */
  function answerMunicipality(name: string, originalQuestion: string) {
    setMunicipality(name);
    void ask(originalQuestion, name);
  }

  return (
    <div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void ask(input);
        }}
        className="rounded-xl border border-line bg-surface p-5"
      >
        <label className="block text-sm font-semibold" htmlFor="chat-input">
          困りごとを書いてください
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="chat-input"
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="ペットボトルってどう捨てるの？"
            className="min-w-0 flex-1 rounded-lg border border-line bg-background px-3 py-2"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-accent px-5 py-2 font-semibold text-surface disabled:opacity-50"
          >
            {pending ? '考え中…' : '聞く'}
          </button>
        </div>
        <p className="mt-3 text-sm text-muted">
          例：
          {EXAMPLES.map((example, index) => (
            <span key={example}>
              {index > 0 && '、'}
              <button
                type="button"
                onClick={() => void ask(example)}
                className="underline underline-offset-2 hover:no-underline"
              >
                {example}
              </button>
            </span>
          ))}
        </p>
        {municipality && (
          <p className="mt-3 text-xs text-muted">
            お住まいの区市町村を「{municipality}」として覚えています。
            <button
              type="button"
              onClick={() => setMunicipality('')}
              className="ml-2 underline underline-offset-2 hover:no-underline"
            >
              変更する
            </button>
          </p>
        )}
      </form>

      <div className="mt-6 space-y-6">
        {turns.map((turn, index) => (
          <section key={`${turn.question}-${index}`}>
            <p className="rounded-lg bg-surface px-4 py-2 text-sm font-medium">{turn.question}</p>
            <div className="mt-3">
              <ChatAnswer
                response={turn.response}
                question={turn.question}
                onPickMunicipality={answerMunicipality}
              />
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function ChatAnswer({
  response,
  question,
  onPickMunicipality,
}: {
  response: ChatResponse;
  /** 聞き返しに答えたときは、この元の質問文をそのまま投げ直す */
  question: string;
  onPickMunicipality: (name: string, originalQuestion: string) => void;
}) {
  if (response.type === 'error') {
    return <p className="rounded-xl border border-line bg-surface p-5 text-sm">{response.message}</p>;
  }

  if (response.type === 'ask_municipality') {
    return (
      <div className="rounded-xl border border-line bg-surface p-5">
        <p className="leading-relaxed">{response.message}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {MUNICIPALITIES.map((m) => (
            <button
              key={m.code}
              type="button"
              onClick={() => onPickMunicipality(m.name, question)}
              className="rounded-lg border border-line px-4 py-2 text-sm font-medium hover:border-accent"
            >
              {m.name}
              {m.supported ? '' : '（未対応）'}
            </button>
          ))}
        </div>
        <ViaNote via={response.via} />
      </div>
    );
  }

  if (response.type === 'links') {
    return (
      <div className="rounded-xl border border-line bg-surface p-5">
        <p className="leading-relaxed">{response.message}</p>
        <ul className="mt-3 space-y-2">
          {response.links.map((link) => (
            <li key={link.id}>
              <a
                className="text-sm font-semibold text-accent underline underline-offset-2 hover:no-underline"
                href={link.url}
                target="_blank"
                rel="noreferrer"
              >
                {link.org}「{link.name}」<span aria-hidden>↗</span>
              </a>
            </li>
          ))}
        </ul>
        <ViaNote via={response.via} />
      </div>
    );
  }

  // answer（ごみ分別）と bouhan（防犯）はどちらも共通画面契約なので同じ描き方でよい
  return (
    <div>
      <AnswerCard result={response.result} />
      {response.type === 'bouhan' && (
        <p className="mt-2 text-xs">
          <Link
            href={`/bouhan?a=${encodeURIComponent(response.area)}`}
            className="text-accent underline underline-offset-2 hover:no-underline"
          >
            もう1つの町丁と並べて比べる →
          </Link>
        </p>
      )}
      {response.type === 'manabi' && response.result.facilities.length > 0 && (
        <p className="mt-2 text-xs">
          <Link
            href={`/manabi?${response.query}`}
            className="text-accent underline underline-offset-2 hover:no-underline"
          >
            地図で見る →
          </Link>
        </p>
      )}
      {response.type === 'barrierfree' && (
        <p className="mt-2 text-xs">
          <Link
            href={`/barrierfree?${response.query}`}
            className="text-accent underline underline-offset-2 hover:no-underline"
          >
            条件を足して絞り込む →
          </Link>
        </p>
      )}
      <ViaNote via={response.via} />
    </div>
  );
}

/** どの経路で判定したかを隠さない。Geminiが落ちていればそう表示される */
function ViaNote({ via }: { via: string }) {
  return (
    <p className="mt-2 text-xs text-muted">
      分野の判定: {via}（答えの本文は東京都のオープンデータそのもので、AIは作成に関与していません）
    </p>
  );
}
