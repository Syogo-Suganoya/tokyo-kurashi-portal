/**
 * Next.js を Cloudflare Workers に載せるための設定。
 *
 * この画面は取り込み済みの静的JSONを読むだけで、書き込みも外部APIへの往復も無い。
 * キャッシュ層（R2 など）を足す理由が無いので、既定のまま何も差し込まない。
 */

import { defineCloudflareConfig } from '@opennextjs/cloudflare';

export default defineCloudflareConfig();
