# くらしの道しるべ デプロイ手順

本番構成は以下を想定する。各手順は**コマンド（CLI）**と**画面操作（Cloudflare ダッシュボード）**の両方を記載する。どちらか一方を実施すればよい。

| コンポーネント | デプロイ先 |
| :--- | :--- |
| アプリ本体（Next.js App Router） | **Cloudflare Workers**（`@opennextjs/cloudflare` でビルド） |
| AI（分野判定とパラメータ抽出） | **Cloudflare Workers AI**（`AI` バインディング） |
| データ保存 | **なし**。オープンデータはビルド前に静的JSONへ変換してリポジトリにコミット済み |
| 地図 | 国土地理院 淡色地図タイル。APIキーも利用登録も不要 |

> **この構成の要点は「当日、外部の都合で止まる箇所を消す」こと。**
>
> - 都・区市町村・警視庁のCSVはすべて取り込み済みで、`src/data/generated/*.json` としてコミットされている。ビルドが行政のサーバの都合で失敗しない
> - **AIのAPIキーが存在しない。** 推論はアプリと同じ Cloudflare 上で動き、バインディング経由で呼ぶ。鍵を配って回る先が無いので、鍵の失効・流出・貼り忘れで止まらない
> - 地図タイルも登録不要
> - それでも Workers AI が応答しないときは、キーワード判定に落ちて画面は動き続ける

## 0. 前提条件

- GitHub アカウントと、このリポジトリへのpush権限があること
- **Cloudflare アカウント**。今回はハッカソン運営から**有料プランのアカウントが付与される**ので、それを使う
  - Workers AI の利用上限やモデルの選択肢は無料プランより広い。ただし**この構成は無料枠でも動く**ように作ってあり、有料であることに依存した機能は使っていない
- Node.js 20.9 以上（Next.js 16 の要件）。開発時の実績は v26.7.0 / npm 11.19.0

```bash
# CLIの場合: wrangler はこのリポジトリの devDependency に入っている
npx wrangler login
```

---

## 1. デプロイ前の確認（毎回）

本番と同じ手順が手元で通ることを先に確かめる。ここで落ちるものは Cloudflare でも落ちる。

```bash
npm ci
npm run lint
npm run check:types
npm run preview        # workerd で実際に動かす。ブラウザで http://localhost:8788 を開く
```

`npm run preview` は `opennextjs-cloudflare build` → `preview` の順に走り、**本番と同じ workerd 上でアプリを動かす**。
`npm run dev`（素の Next.js）だけで確認して満足しないこと。動く場所が違う。

`opennextjs-cloudflare build` は内部で `npm run build` を呼ぶので、`prebuild` の MapLibre ワーカー配置もそのまま走る。
**この配置が無いと、地図タイルは出るのに点だけが永久に描かれない**（Turbopack が既定のワーカーURLを解決できないため）。

> 生成JSON（`src/data/generated/*.json`）に差分が出ていないかも確認する。
> データを取り込み直した場合は、**必ずコミットしてからデプロイする**。コミットし忘れると古いデータのまま公開される。

---

## 2. GitHub へ push

```bash
git status          # 生成JSONを含め、すべてコミット済みか確認する
git push origin main
```

---

## 3. Cloudflare へのデプロイ（初回）

### 3.1. デプロイする

**コマンド:**

```bash
npx wrangler login     # 初回のみ。ブラウザで認可する
npm run deploy         # ビルドして Workers へ上げる
```

完了すると `https://tokyo-kurashi-portal.<アカウントのサブドメイン>.workers.dev` が表示される。控えておく。

**画面操作（GitHub 連携で自動デプロイにする場合）:**

1. [Cloudflare ダッシュボード](https://dash.cloudflare.com/) →「**Compute (Workers)**」→「**Create**」
2. 「**Import a repository**」で `Syogo-Suganoya/tokyo-kurashi-portal` を選ぶ
3. ビルド設定を以下にする
   - Build command: `npx opennextjs-cloudflare build`
   - Deploy command: `npx wrangler deploy`
4. 「**Create and deploy**」
5. 以降、`main` への push で自動デプロイされる

> `wrangler.jsonc` に書いてある内容（Worker名・`AI` バインディング・アセットの置き場・使うモデル）は
> **リポジトリの側が持っている**。ダッシュボードで設定し直す必要はない。

### 3.2. Workers AI を使えるようにする

**追加の設定は要らない。** `wrangler.jsonc` の

```jsonc
"ai": { "binding": "AI" }
```

がアカウントの Workers AI に繋がる。**APIキーの発行も貼り付けも無い。**

使うモデルは同じファイルの `vars` にある。

```jsonc
"vars": { "WORKERS_AI_MODEL": "@cf/meta/llama-3.3-70b-instruct-fp8-fast" }
```

モデルを変えるときは、**function calling（tool calling）に対応したもの**を選ぶこと。
対応していないモデルを指定すると、ツールが選ばれず毎回キーワード判定に落ちる（画面はそのことを表示する）。

### 3.3. 環境変数

**このアプリに秘密の値は無い。**

| 変数名 | 置き場所 | 用途 |
| :--- | :--- | :--- |
| `WORKERS_AI_MODEL` | `wrangler.jsonc` の `vars` | 分野判定に使うモデル |

手元で一時的にモデルを差し替えたいときだけ `.dev.vars` に書く（このファイルは git に入らない）。

```
WORKERS_AI_MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct"
```

### 3.4. カスタムドメイン（任意）

1. Worker →「**Settings**」→「**Domains & Routes**」→「**Add**」→ Custom domain
2. 独自ドメインを設定した場合は、`NEXT_PUBLIC_SITE_URL` を `wrangler.jsonc` の `vars` に足して再デプロイする（共有カードの画像URLが絶対URLで必要なため）

---

## 4. デプロイ後の確認

公開URLを `$URL` として、以下をすべて通す。**提出前は必ず全部見る。**

| # | 確認すること | 見かた |
| :--- | :--- | :--- |
| 1 | トップが出る | `$URL/` |
| 2 | ごみ分別が引ける | `$URL/gomi?m=tachikawa&q=アイロン台` → 「粗大ごみ」「100円」 |
| 3 | 犯罪認知件数が出る | `$URL/bouhan?a=西新宿７丁目` → 136件と前年比 |
| 4 | **地図が描かれる**（点まで） | `$URL/manabi?m=中野区` → 地図に緑の点。**タイルだけ出て点が無いならワーカー配置の失敗** |
| 5 | バリアフリーが絞れる | `$URL/barrierfree?f=ostomate&c=station` → 一覧と地図 |
| 6 | チャットが答える | `$URL/chat?q=アイロン台を捨てたい` → 区市町村を聞き返す |
| 7 | **Workers AI が効いている** | 上の回答に「Workers AI」と出ること。「キーワード判定（…）」なら落ちている |
| 8 | 共有カードが出る | `$URL/opengraph-image.png` が 1200×630 で開く |
| 9 | タブのアイコン | `$URL/icon.svg` が開く |

**ログの見かた:**

- **画面操作**: Worker →「**Observability**」→「**Logs**」（`wrangler.jsonc` で有効にしてある）
- **コマンド**: `npx wrangler tail`

---

## 5. 2回目以降の更新

```bash
npm run deploy
```

GitHub 連携をしている場合は `main` への push で自動デプロイされる。どちらの場合も 4章の確認を行う。

### ロールバック

- **画面操作**: Worker →「**Deployments**」→ 戻したいバージョンの「⋮」→「**Rollback**」
- **コマンド**: `npx wrangler rollback`

> 生成JSONもリポジトリに入っているので、**ロールバックすればデータもその時点に戻る**。
> 取り込みの失敗を本番に出してしまった場合も、1操作で戻せる。

### 段階的に出したいとき

```bash
npm run upload     # 新しいバージョンを作るだけ。本番のトラフィックは動かさない
```

ダッシュボードの「Deployments」で、そのバージョンに何%流すかを決められる。

---

## 6. データを更新するとき

オープンデータの更新はコード変更と同じ扱いで、**コミットしてからデプロイする**。

```bash
npm run check:data     # 元データが更新されていないかだけを確認する（安価）
npm run build:data     # 更新があれば取り込み直す
git diff --stat        # 件数が想定どおり動いているか目で見る
git add src/data/generated && git commit -m "データを更新"
git push origin main
```

`check:data` は生成JSONに残した ETag / Last-Modified で条件付きリクエストを投げるだけなので軽い。
更新を検知すると**終了コード 2** を返すので、定期実行から拾って自動化もできる。

取り込みには検証（列ズレ・小計突合・案内先の疎通確認）が入っているので、**壊れたデータはここで止まる**。
`build:data` が落ちたときは、公開側のCSVの形が変わったということ。落ちたまま古いJSONで公開し続ける方が安全なので、原因が分かるまでデプロイしない。

---

## 7. つまずきやすい点

| 症状 | 原因と対処 |
| :--- | :--- |
| 地図のタイルは出るが**点が1つも描かれない** | MapLibre のワーカーが `.open-next/assets/maplibre/` に無い。`prebuild`（`scripts/copy-map-worker.mjs`）が走っているかビルドログで確認する |
| チャットに「キーワード判定（推論に失敗）」と出る | Workers AI 側のエラー。`npx wrangler tail` でメッセージを見る。利用上限に当たった場合もここに出る |
| チャットに「キーワード判定（AIバインディング無し）」と出る | `wrangler.jsonc` の `ai` が消えているか、古いバージョンがデプロイされている |
| チャットに「キーワード判定（ツールが選ばれなかった）」と出る | モデルが function calling に対応していない。`WORKERS_AI_MODEL` を対応モデルに戻す |
| `npm run dev` ではAIが効かない | `next.config.ts` の `initOpenNextCloudflareForDev()` が要る。それでも駄目なら `npx wrangler login` |
| ビルドが型エラーで落ちる | 手元で `npm run check:types` が通っているか。アプリとスクリプトで tsconfig が分かれている |
| `wrangler types` の後に型が壊れた | `wrangler.jsonc` を変えたら `npm run cf-typegen` を実行し、`cloudflare-env.d.ts` をコミットする |

---

## 8. この構成で「やらない」と決めたこと

| 項目 | 理由 |
| :--- | :--- |
| 外部のLLM APIを使う（Gemini / OpenAI など） | アプリと同じ Cloudflare 上で推論できるなら、**APIキーという壊れる部品を1つ減らせる**。分野判定とパラメータ抽出しかさせないので、モデルの賢さより「当日確実に動くこと」を採る |
| 外部DB（D1 / KV / Supabase等）を置く | データは数万件だが読み取り専用で、静的JSONで足りる。書き込みが1つも無いのにDBを置く理由が無い |
| 実行時にオープンデータを取得する | 公開CSVの更新は月〜年の単位でしか動かないためリアルタイムにならず、**壊れたデータを止める検証の門を失うだけ**になる |
| OGP画像を実行時に生成する | 日本語フォントを実行時に用意しないと文字がすべて豆腐になる。フォントの配信元に当日の成否を握らせない（画像は静的PNGをコミット） |
