import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'くらしの道しるべ',
  description:
    'ごみの分別も、引っ越し先の治安も、車椅子で入れるお店も。東京都のオープンデータからその場でお答えします。ここに答えが無いことは、それを扱っている公式のサービスへご案内します。',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
