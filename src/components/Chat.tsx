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
import { MunicipalityPicker } from '@/components/MunicipalityPicker';
import { MUNICIPALITIES } from '@/data/municipalities';
import { useSavedMunicipalities } from '@/lib/use-saved-municipalities';
import type { ChatResponse } from '@/app/api/chat/route';

const EXAMPLES = [
  'ペットボトルってどう捨てるの？',
  'アイロン台を捨てたい',
  '西新宿７丁目の治安が知りたい',
  '車椅子で入れるお店を探したい',
  '近くのAEDを探したい',
];

type Turn = { question: string; response: ChatResponse };

/** 保存はコードで持っているので、表示するときに名前へ戻す */
function nameOfMunicipality(codeOrName: string): string {
  return MUNICIPALITIES.find((m) => m.code === codeOrName || m.name === codeOrName)?.name ?? codeOrName;
}

export function Chat({ initialQuestion = '' }: { initialQuestion?: string }) {
  const [input, setInput] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pending, setPending] = useState(false);
  // 一度答えてもらった自治体はセッション中は保持し、以降は聞き返さない（設計書 §4.3）。
  // 端末に覚えているものがあれば、そもそも一度目から聞き返さない
  const [municipality, setMunicipality] = useState('');
  const { saved, ready: savedReady } = useSavedMunicipalities();
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  /** トップから渡された質問を一度だけ送る。開発時の再マウントで二重送信しないよう見張る */
  const sentInitial = useRef(false);

  /**
   * 新しい答えが増えたら末尾まで送る。
   * 入力欄が下端に固定されている以上、**答えは入力欄のすぐ上に出ていないと見えない**。
   */
  useEffect(() => {
    const box = scrollRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [turns.length, pending]);

  async function ask(question: string, withMunicipality = municipality || saved[0] || '') {
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

  /**
   * トップページのフォームから来たときは、その質問をそのまま投げる。
   * ただし**端末に覚えている区市町村の読み込みを待ってから**送る。
   * 先に送ってしまうと、覚えているのに一度だけ聞き返すことになる。
   */
  useEffect(() => {
    if (!initialQuestion || sentInitial.current || !savedReady) return;
    sentInitial.current = true;
    void ask(initialQuestion, saved[0] ?? '');
    // ask は毎レンダリング作り直されるので依存に入れない。初回だけ動かすのが目的
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion, savedReady]);

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
    <div className="flex min-h-0 flex-1 flex-col">
      {/* やり取りだけがスクロールする。入力欄は下端に置いたまま動かさない */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto pb-4">
        {turns.length === 0 ? (
          <div className="rounded-xl border border-line bg-surface p-5">
            <p className="leading-relaxed">
              思いついたままの言葉で大丈夫です。答えを持っていればその場でお答えし、
              持っていなければ、それを扱っている公式のサービスをご案内します。
            </p>
            <p className="mt-4 text-sm font-semibold">たとえば</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {EXAMPLES.map((example) => (
                <li key={example}>
                  <button
                    type="button"
                    onClick={() => void ask(example)}
                    className="rounded-full border border-line px-3 py-1.5 text-sm hover:border-accent hover:text-accent"
                  >
                    {example}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="space-y-6">
            {turns.map((turn, index) => (
              <section key={`${turn.question}-${index}`}>
                <p className="ml-auto w-fit max-w-[85%] rounded-lg bg-accent-soft px-4 py-2 text-sm font-medium">
                  {turn.question}
                </p>
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
        )}
        {pending && (
          <p className="mt-4 text-sm text-muted" role="status">
            考え中…
          </p>
        )}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void ask(input);
        }}
        className="shrink-0 border-t border-line bg-background pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
        <label className="sr-only" htmlFor="chat-input">
          困りごとを書いてください
        </label>
        <div className="flex gap-2">
          <input
            id="chat-input"
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="ペットボトルってどう捨てるの？"
            className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-accent px-5 py-2 font-semibold text-surface disabled:opacity-50"
          >
            {pending ? '考え中…' : '聞く'}
          </button>
        </div>
        {(municipality || (savedReady && saved.length > 0)) && (
          <p className="mt-2 text-xs text-muted">
            区市町村を「{nameOfMunicipality(municipality || saved[0])}」として扱っています。
            <button
              type="button"
              onClick={() => setMunicipality('')}
              className="ml-2 underline underline-offset-2 hover:no-underline"
            >
              次の質問で選び直す
            </button>
          </p>
        )}
      </form>
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
        <MunicipalityPicker onPick={(code) => onPickMunicipality(code, question)} />
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

/** どの経路で判定したかを隠さない。Workers AI が落ちていればそう表示される */
function ViaNote({ via }: { via: string }) {
  return (
    <p className="mt-2 text-xs text-muted">
      分野の判定: {via}（答えの本文は東京都のオープンデータそのもので、AIは作成に関与していません）
    </p>
  );
}
