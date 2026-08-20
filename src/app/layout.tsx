import type { Metadata } from 'next';
import './globals.css';

const TITLE = 'くらしの道しるべ';
const DESCRIPTION =
  'ごみの分別も、引っ越し先の治安も、車椅子で入れるお店も。東京都のオープンデータからその場でお答えします。ここに答えが無いことは、それを扱っている公式のサービスへご案内します。';

/**
 * 共有カードの画像は絶対URLでないと読まれないため、置き場所を明示する。
 *
 * Cloudflare Workers には「自分の公開URL」を教えてくれる環境変数が無いので、
 * 公開先を直に書く。**ここが古いと共有カードの画像だけが出なくなる**
 * （リンクは正しいのに画像が欠ける、という気づきにくい壊れ方をする）。
 */
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://tokyo-kurashi-portal.tokyo-odh-039.workers.dev';

/**
 * 画像そのものは `opengraph-image.png`（説明文は `opengraph-image.alt.txt`）を
 * Next.js が拾って `og:image` に入れる。ここには書かない。
 */
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: TITLE,
  openGraph: {
    type: 'website',
    locale: 'ja_JP',
    url: '/',
    siteName: TITLE,
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
