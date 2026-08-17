# デプロイ手順書 — Cloudflare Workers + Workers AI

| 役割 | サービス | 費用 |
| :--- | :--- | :--- |
| アプリ本体 (Next.js SSR + API) | Cloudflare Workers（OpenNextアダプタ経由） | ハッカソン運営から付与される**有料プラン**を使う。無料プランの範囲（1日10万リクエスト）でも動く |
| 分野判定のAI | Cloudflare Workers AI（`AI` バインディング） | 同アカウントに含まれる。**APIキーの発行は不要** |
| データ | **なし**（取り込み済みの静的JSONをリポジトリに同梱） | 0円 |
| 地図 | 国土地理院 淡色地図タイル | 0円・利用登録不要 |

Cloudflare のアカウントは付与されているものとして書いている（サインアップ手順は省略）。

> **なぜこの構成か**
>
> SSR＋APIルートがあるため、静的ホスティングだけでは動かない。
> Cloudflare Workers は Next.js をそのままでは実行できないので、**OpenNext の Cloudflare アダプタ**
> （`@opennextjs/cloudflare`）で Next.js のビルド成果物を Worker 用にバンドルする。
>
> **AIに外部のAPI（Gemini / OpenAI など）を使わないのも、この構成に載せるため**である。
> アプリと同じ Cloudflare 上で推論すれば `AI` バインディングで呼べて、**APIキーという壊れる部品が
> 構成から消える**。鍵の失効・流出・貼り忘れで当日止まる経路が無くなる。
> AIにさせるのは分野の判定とパラメータ抽出だけなので、モデルの賢さより「当日確実に動くこと」を採った。
>
> **DBを置いていない**のも同じ理由。扱うのは数万件だが読み取り専用で、
> ビルド前に静的JSONへ変換してリポジトリに入れてある。書き込みが1つも無いのにDBを置く理由が無く、
> 置けば当日落ちうる部品が1つ増えるだけになる。

## Cloudflare 対応として入れてある仕組み（適用済み）

以下はすでにリポジトリに入っている。読み飛ばして「手順1」へ進んでよいが、
つまずいたときの手がかりとして残しておく。

| ファイル | 内容 |
| :--- | :--- |
| `wrangler.jsonc` | Worker名・エントリ・`nodejs_compat`・アセット・**`AI` バインディング**・使うモデル |
| `open-next.config.ts` | OpenNextアダプタの設定（既定のまま） |
| `next.config.ts` | `initOpenNextCloudflareForDev()`（`next dev` でもバインディングを繋ぐ） |
| `package.json` | `preview` / `deploy` / `upload` / `cf-typegen` スクリプト、`@opennextjs/cloudflare` と `wrangler` |
| `cloudflare-env.d.ts` | `npm run cf-typegen` の生成物。**コミットする**（無いと型検査が通らない） |
| `tsconfig.json` / `tsconfig.scripts.json` | アプリ（workerd）と取り込みスクリプト（Node）で型の世界を分けてある |
| `src/lib/ai/route-query.ts` | `getCloudflareContext().env.AI` で推論。落ちたらキーワード判定へ |
| `.github/workflows/deploy.yml` | CD（手順3） |

実装時にはまった点が5つあるので、内容を変えるときは注意すること。

**1. Next.js は 16.2.11 以上が必要**

`@opennextjs/cloudflare` のピア依存が `>=15.5.21 <16 || >=16.2.11` で、16.2.10 は除外されている。
このアプリは **16.3.1** なので条件を満たす。Next.js を下げるときはここに当たる。

**2. MapLibre のワーカーが成果物に入っていないと、地図の点だけが描かれない**

Turbopack は MapLibre のワーカーURLを解決できず、ワーカーの取得がHTMLを返して失敗する。
`setWorkerUrl('/maplibre/maplibre-gl-worker.mjs')` で明示し、実体は `prebuild` が
`node_modules` から `public/` へコピーしている。

**タイルは正常に出るので、見た目では気づきにくい。** CI（`deploy.yml`）に
`.open-next/assets/maplibre/maplibre-gl-worker.mjs` の存在チェックを入れてある。

**3. Workers AI のツール呼び出しは2つの形で返りうる（重要）**

Cloudflare の型定義自身が、`tool_calls` を次の2つの交差として宣言している。

```ts
type AiTextGenerationToolLegacyOutput = { name: string; arguments: unknown };
type AiTextGenerationToolOutput = { id: string; type: "function";
  function: { name: string; arguments: string } };   // arguments は JSON 文字列
```

どちらで返るかはモデル次第なので、`normalizeToolCall` で両方を受けてから使う。
片方だけを前提にすると、モデルを差し替えた瞬間に**毎回キーワード判定へ落ちる**（画面は動くので気づきにくい）。

**4. モデルは入力の言葉を書き換える**

`@cf/meta/llama-3.3-70b-instruct-fp8-fast` は「西新宿７丁目」を「西新宿七丁目」に直して
`area` に入れてくる。元データの町丁名は全角数字なので、そのままでは検索が0件になっていた。

システムプロンプトで「数字を漢数字に直してはいけない」と書いても直らなかったため、
**検索キーの正規化側で受け止めている**（`src/lib/text.ts` で丁目の漢数字を数字に畳む）。
プロンプトに頼らず、データを引く側で吸収するのが正しい層。

> 畳むのは「丁目」の直前だけにしてある。「番」まで広げると千代田区**一番町**・**三番町**のような
> 実在の町名を数字に化けさせる。あれは番地ではなく町の名前。

**5. workerd の型と @types/node が衝突する**

`wrangler types` が生成する `cloudflare-env.d.ts` は `Buffer` などのグローバルを自前で宣言する。
取り込みスクリプトは Node で動くのでこれを読ませたくない。
`tsconfig.json`（アプリ）と `tsconfig.scripts.json`（スクリプト）に分け、`npm run check:types` が両方を走らせる。

> なお npm 11 は既定でインストールスクリプトを実行しない。`workerd` と `esbuild` はバイナリを
> postinstall で取得するため、承認が要る。承認結果は `package.json` の `allowScripts` に
> 記録済みなので、**クローン後の `npm ci` はそのまま通る**。

## 手順1: Cloudflare にログインする（約2分）

```bash
npx wrangler login     # ブラウザが開いて認可に進む
npx wrangler whoami    # アカウントIDを控える（手順3で使う）
```

`wrangler` はこのリポジトリの devDependency に入っているので、グローバルインストールは要らない。

## 手順2: 手元で Worker として動かす（約5分）

```bash
npm ci
npm run lint
npm run check:types
npm run preview        # http://localhost:8788
```

`npm run preview` は `opennextjs-cloudflare build` → `preview` の順に走り、**本番と同じ workerd 上で**
アプリを動かす。`npm run dev`（素のNext.js）は動く場所が違うので、これだけで確認を終えないこと。

次を目で確認する。

| 確認すること | 見かた |
| :--- | :--- |
| ごみ分別が引ける | `/gomi?m=tachikawa&q=アイロン台` → 「粗大ごみ」「100円」 |
| 犯罪認知件数が出る | `/bouhan?a=西新宿７丁目` → 136件・前年比 +38件 |
| **地図の点が描かれる** | `/manabi?m=中野区` → 緑の点。**タイルだけで点が無いなら上記「はまった点2」** |
| バリアフリーが絞れる | `/barrierfree?f=ostomate&c=station` → 582か所と地図 |
| **AIが効いている** | `/chat` で「西新宿７丁目の治安が知りたい」→ 末尾に「分野の判定: **Workers AI**」 |

「キーワード判定（…）」と出る場合は AI に繋がっていない。カッコ内の理由を見る（後述の表）。

## 手順3: GitHub Actions で CD を組む（約15分）

デプロイは **GitHub Actions**（[`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)）で行う。
Cloudflare 側の Workers Builds（GitHub連携）は使わない。ビルドの中身をリポジトリ側で
管理でき、PR時にビルドとlintだけ回して main へのマージ時だけデプロイする、という
切り分けができるため。

### ワークフローの構成

| ジョブ | 実行タイミング | 内容 |
| :--- | :--- | :--- |
| `build` | `main` への push / `main` への PR / 手動実行 | `npm ci` → `npm run lint` → `npm run check:types` → `npx opennextjs-cloudflare build` → **地図ワーカーの同梱チェック** |
| `deploy` | `main` への push / 手動実行（PRでは走らない） | 再ビルド → アカウントIDの確認 → `npx wrangler deploy` |

`environment: production` を付けてあるので、GitHubの Settings → Environments で
`production` に承認者を設定すれば、デプロイ前に手動承認を挟むこともできる（任意）。

### 手順3-1: アカウントIDを書き込む

`.github/workflows/deploy.yml` の

```yaml
CLOUDFLARE_ACCOUNT_ID: REPLACE_WITH_ACCOUNT_ID
```

を手順1で控えたIDに書き換えてコミットする。アカウントIDは秘匿情報ではないので直書きでよい。
プレースホルダのままだと `deploy` ジョブが `Check account id` で止まる。

### 手順3-2: Cloudflare APIトークンを作る（テンプレートを使わない）

「Edit Cloudflare Workers」テンプレートは Workers 以外の権限まで含むため使わず、
**Create Custom Token** で必要な権限だけを付けたトークンを作る。

1. https://dash.cloudflare.com/profile/api-tokens → **Create Token**
2. 一番下の **Create Custom Token** の **Get started** を押す（テンプレートは選ばない）
3. Token name: `kurashi-michishirube-github-actions` など
4. **Permissions** に次を追加する

   | 種別 | 対象 | 権限 | 用途 |
   | :--- | :--- | :--- | :--- |
   | Account | Workers Scripts | Edit | Worker本体とアセットのアップロード（**必須**） |

   これだけで上がる。**足すのは失敗してからでよい。**
   `open-next.config.ts` に R2 のキャッシュを足した場合は `Workers R2 Storage: Edit` が要る。
   権限不足のときは `wrangler deploy` が不足している権限名を出すので、それを見て追加する。

5. **Account Resources** で `Include → 対象のアカウント` を選ぶ
6. **Client IP Address Filtering** は空のままにする
   （GitHub Actions のランナーはIPが固定されないため、絞ると失敗する）
7. **TTL** は必要に応じて設定する（無期限でよければ空のまま）
8. **Continue to summary** → **Create Token** → **表示されたトークンをコピーする**
   （この画面を閉じると二度と表示されない）

### 手順3-3: GitHub に Secrets を登録する

GitHubリポジトリ → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

| 名前 | 値 |
| :--- | :--- |
| `CLOUDFLARE_API_TOKEN` | 手順3-2でコピーしたトークン |

**登録するのはこの1件だけ。** アプリ側にAPIキーが無いので、他に渡す秘密の値が存在しない。

### 手順3-4: 動かす

1. `main` に push する（または Actions タブ → **Deploy to Cloudflare Workers** → **Run workflow**）
2. Actions タブでジョブの成否を確認する
3. 発行されたURL（`https://tokyo-kurashi-portal.<アカウント名>.workers.dev`）で動作確認（次章）

### 手動でデプロイする場合

GitHub連携を使わず手元から直接上げることもできる。

```bash
npx wrangler login
npm run deploy              # opennextjs-cloudflare build && deploy
```

段階的に出したいときは `npm run upload` で新しいバージョンだけを作り、
ダッシュボードの「Deployments」で流す割合を決める。

## デプロイ後の確認

公開URLを `$URL` として、以下をすべて通す。**提出前は必ず全部見る。**

| # | 確認すること | 見かた |
| :--- | :--- | :--- |
| 1 | トップが出る | `$URL/` |
| 2 | ごみ分別が引ける | `$URL/gomi?m=tachikawa&q=アイロン台` → 「粗大ごみ」「100円」 |
| 3 | 犯罪認知件数が出る | `$URL/bouhan?a=西新宿７丁目` → 136件・前年比 +38件 |
| 4 | **地図の点が描かれる** | `$URL/manabi?m=中野区` → 緑の点 |
| 5 | バリアフリーが絞れる | `$URL/barrierfree?f=ostomate&c=station` → 一覧と地図 |
| 6 | チャットが聞き返す | `$URL/chat?q=アイロン台を捨てたい` → 区市町村を聞き返す |
| 7 | **Workers AI が効いている** | 上の回答の末尾が「分野の判定: Workers AI」 |
| 8 | 共有カードが出る | `$URL/opengraph-image.png` が 1200×630 で開く |
| 9 | タブのアイコン | `$URL/icon.svg` が開く |

ログは Worker の **Observability → Logs**（`wrangler.jsonc` で有効にしてある）か `npx wrangler tail`。

### ロールバック

- **画面操作**: Worker →「**Deployments**」→ 戻したいバージョンの「⋮」→「**Rollback**」
- **コマンド**: `npx wrangler rollback`

生成JSONもリポジトリに入っているので、**ロールバックすればデータもその時点に戻る**。
取り込みの失敗を本番に出してしまった場合も、1操作で戻せる。

## デプロイ後の注意

- **Worker の環境変数にAPIキーを足さない。** このアプリは秘密の値を持たない設計で、
  推論は `AI` バインディング経由で行う。鍵を足すと、その鍵が当日壊れうる部品になる。

- **モデルを変えるときは function calling 対応のものを選ぶ**（`wrangler.jsonc` の `WORKERS_AI_MODEL`）。
  非対応のモデルを指定すると、ツールが選ばれず毎回キーワード判定に落ちる。**画面は動いてしまう**ので、
  変えたら必ず `/chat` で「分野の判定: Workers AI」を確認する。

- **`wrangler.jsonc` を変えたら `npm run cf-typegen` を実行し、`cloudflare-env.d.ts` をコミットする。**
  忘れると型検査が通らず CI が落ちる。

- **本番へ上げる前に `npm run preview` で必ず一度動かすこと。** `next dev` は素のNodeで動くため、
  Workers 固有の問題（バインディングの有無、ランタイム差）は `next dev` では再現しない。

- データを更新したいときは、コード変更と同じ扱いで**コミットしてからデプロイする**。

  ```bash
  npm run check:data     # 元データが更新されていないかだけを確認する（安価）
  npm run build:data     # 更新があれば取り込み直す
  git diff --stat        # 件数が想定どおり動いているか目で見る
  git add src/data/generated && git commit -m "データを更新" && git push
  ```

  取り込みには検証（列ズレ・小計突合・案内先の疎通確認）が入っているので、**壊れたデータはここで止まる**。
  `build:data` が落ちたときは公開側のCSVの形が変わったということ。
  古いJSONのまま公開し続ける方が安全なので、原因が分かるまでデプロイしない。

- 有料プランなので上限には余裕があるが、**構成は無料枠でも動く形を保つ**。
  有料前提の機能に寄りかかると、アカウントの提供が終わったときに動かなくなる。

## つまずきやすい点

| 症状 | 原因と対処 |
| :--- | :--- |
| 地図のタイルは出るが**点が1つも描かれない** | MapLibre のワーカーが `.open-next/assets/maplibre/` に無い。`prebuild`（`scripts/copy-map-worker.mjs`）が走っているかビルドログで確認する（はまった点2） |
| 「キーワード判定（推論に失敗）」と出る | Workers AI 側のエラー。`npx wrangler tail` でメッセージを見る。利用上限に当たった場合もここに出る |
| 「キーワード判定（AIバインディング無し）」と出る | `wrangler.jsonc` の `ai` が消えているか、古いバージョンがデプロイされている |
| 「キーワード判定（ツールが選ばれなかった）」と出る | モデルが function calling に対応していない。`WORKERS_AI_MODEL` を対応モデルに戻す |
| 「キーワード判定（Cloudflareの外で実行中）」と出る | Cloudflare 以外の場所で動かしている。`npm run dev` なら `next.config.ts` の `initOpenNextCloudflareForDev()` と `npx wrangler login` を確認する |
| ビルドが型エラーで落ちる | 手元で `npm run check:types` が通っているか。アプリとスクリプトで tsconfig が分かれている（はまった点5） |
| `wrangler deploy` が権限エラーで落ちる | APIトークンの Permissions を確認する。エラーに不足している権限名が出る（手順3-2） |
| CI が `Check account id` で止まる | `deploy.yml` の `CLOUDFLARE_ACCOUNT_ID` がプレースホルダのまま（手順3-1） |
