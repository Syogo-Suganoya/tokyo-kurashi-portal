import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // ホームディレクトリ側にある無関係な package-lock.json を拾わないよう、
  // このリポジトリをルートとして明示する
  turbopack: { root: dirname(fileURLToPath(import.meta.url)) },
};

export default nextConfig;

/**
 * `next dev` でも Cloudflare のバインディング（Workers AI など）を使えるようにする。
 * これが無いと、手元では分野判定が常にキーワード判定へ落ちる。
 *
 * **開発サーバのときだけ呼ぶ。** この関数は wrangler を起動して Cloudflare へ接続しに行くため、
 * 素直に呼ぶと `next build` や `next typegen` でも走る。すると**ビルドに Cloudflare の認証が要る**。
 * 実測すると、認証の無い環境では `opennextjs-cloudflare build` が
 * 「CLOUDFLARE_API_TOKEN を設定しろ」で終了コード1になり、CIがそのまま落ちる。
 *
 * バインディングは wrangler.jsonc から本番に渡るので、ビルド時には要らない。
 * ビルドを外部の認証や通信に依存させない（このリポジトリ全体の方針）。
 */
if (process.env.NODE_ENV === 'development') {
  initOpenNextCloudflareForDev();
}
