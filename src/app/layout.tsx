import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'くらしの道しるべ',
  description:
    '生活の困りごとに、東京都のオープンデータからその場で答えを返します。答えられない部分は、限界を明示して公式サービスへご案内します。',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
