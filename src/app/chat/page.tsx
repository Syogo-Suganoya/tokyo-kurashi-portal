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

  /*
   * 入力欄を画面の下端に置くため、この画面だけ**高さを使い切る作り**にする。
   * ページ全体がスクロールすると入力欄も一緒に流れてしまうので、
   * スクロールするのはやり取りの部分だけにして、見出しと入力欄は動かさない。
   */
  return (
    <main className="mx-auto flex h-dvh w-full max-w-3xl flex-col px-5">
      <header className="shrink-0 pt-6 pb-4">
        <p className="text-sm">
          <Link href="/" className="text-muted underline underline-offset-2 hover:no-underline">
            くらしの道しるべ
          </Link>
        </p>
        <h1 className="signboard mt-1 text-2xl">困りごとを聞く</h1>
      </header>

      <Chat initialQuestion={initialQuestion} />
    </main>
  );
}
