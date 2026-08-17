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
 */
initOpenNextCloudflareForDev();
