/**
 * 困りごとチャット `/chat`
 *
 * トップページから切り離した独立の画面。
 * トップは「何ができるか」を伝える場所、ここは「実際に聞く」場所と役割を分ける。
 * トップのフォームから `?q=` を付けて飛んでくると、その質問をそのまま投げた状態で開く。
 */

import Link from 'next/link';

import { Chat } from '@/components/Chat';

export const metadata = {
  title: '困りごとを聞く｜くらしの道しるべ',
};

export default async function ChatPage({ searchParams }: PageProps<'/chat'>) {
  const params = await searchParams;
  const initialQuestion = typeof params.q === 'string' ? params.q : '';

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10">
      <p className="text-sm">
        <Link href="/" className="text-muted underline underline-offset-2 hover:no-underline">
          くらしの道しるべ
        </Link>
      </p>
      <h1 className="signboard mt-2 text-3xl">困りごとを聞く</h1>
      <p className="mt-3 max-w-2xl leading-relaxed text-muted">
        思いついたままの言葉で大丈夫です。答えを持っていればその場でお答えし、
        持っていなければ、それを扱っている公式のサービスをご案内します。
      </p>

      <div className="mt-8">
        <Chat initialQuestion={initialQuestion} />
      </div>
    </main>
  );
}
