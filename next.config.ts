import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // ホームディレクトリ側にある無関係な package-lock.json を拾わないよう、
  // このリポジトリをルートとして明示する
  turbopack: { root: dirname(fileURLToPath(import.meta.url)) },
};

export default nextConfig;
