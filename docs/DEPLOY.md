# くらしの道しるべ デプロイ手順

本番構成は以下を想定する。各手順は**コマンド（CLI）**と**画面操作（Vercel ダッシュボード）**の両方を記載する。どちらか一方を実施すればよい。

| コンポーネント | デプロイ先 |
| :--- | :--- |
| アプリ本体（Next.js App Router） | Vercel |
| データ保存 | **なし**。オープンデータはビルド前に静的JSONへ変換してリポジトリにコミット済み |
| AI | Gemini API（Google AI Studio のAPIキー）。分野判定とパラメータ抽出のみに使う |
| 地図 | 国土地理院 淡色地図タイル。APIキーも利用登録も不要 |

> **この構成の要点は「デプロイ時に外部へ取りに行かない」こと。**
> 都・区市町村・警視庁のCSVはすべて取り込み済みで、`src/data/generated/*.json` としてコミットされている。
> ビルドが行政のサーバの都合で失敗することはなく、Gemini APIキーが未設定でも画面は動く（キーワード判定に落ちる）。
> デプロイ当日に外部要因で落ちる箇所を、構成の側で潰してある。

## 0. 前提条件

- GitHub アカウントと、このリポジトリへのpush権限があること
- Vercel アカウントを作成済みで、GitHub と連携済みであること（https://vercel.com/signup ）
- Gemini APIキーを取得済みであること（https://aistudio.google.com/apikey ）
  - **未取得でもデプロイはできる。** その場合チャットはキーワード判定で動き、画面に「キーワード判定（APIキー未設定）」と出る
- Node.js 20.9 以上（Next.js 16 の要件）。開発時の実績は v26.7.0 / npm 11.19.0

```bash
# CLIの場合: Vercel CLI を入れてログインする
npm i -g vercel
vercel login
```

---

## 1. デプロイ前の確認（毎回）

本番と同じ手順が手元で通ることを先に確かめる。ここで落ちるものは Vercel でも落ちる。

```bash
npm ci
npm run lint
npx tsc --noEmit
npm run build
```

`npm run build` は `prebuild` で MapLibre のワーカーを `public/maplibre/` へ配置する。
**このコピーが無いと、地図タイルは出るのに点だけが永久に描かれない**（Turbopack が既定のワーカーURLを解決できないため）。Vercel 上でも `prebuild` は自動で走る。

> 生成JSON（`src/data/generated/*.json`）に差分が出ていないかも確認する。
> データを取り込み直した場合は、**必ずコミットしてからデプロイする**。コミットし忘れると古いデータのまま公開される。

---

## 2. GitHub へ push

```bash
git status          # 生成JSONを含め、すべてコミット済みか確認する
git push origin main
```

---

## 3. Vercel へのデプロイ（初回）

### 3.1. プロジェクトの作成

**画面操作:**

1. [Vercel ダッシュボード](https://vercel.com/dashboard) →「**Add New…**」→「**Project**」
2. 「Import Git Repository」で `Syogo-Suganoya/tokyo-kurashi-portal` を選び「**Import**」
3. 設定はすべて既定のままでよい。Vercel が Next.js を自動判別する
   - Framework Preset: `Next.js`
   - Build Command: 既定（`npm run build`）
   - Output Directory: 既定
   - Install Command: 既定（`npm install`）
4. 「**Environment Variables**」を開き、下の 3.2 の変数を追加する
5. 「**Deploy**」をクリック

**コマンド:**

```bash
cd tokyo-kurashi-portal
vercel link          # 既存プロジェクトに紐付ける／新規作成する
vercel --prod        # 本番デプロイ
```

### 3.2. 環境変数

| 変数名 | 必須 | 値 | 用途 |
| :--- | :--- | :--- | :--- |
| `GEMINI_API_KEY` | 任意 | AI Studio のAPIキー | チャットの分野判定。**未設定でもアプリは動く**（キーワード判定にフォールバック） |
| `GEMINI_MODEL` | 任意 | 既定 `gemini-3.6-flash` | モデルを変えたいときだけ |
| `NEXT_PUBLIC_SITE_URL` | 任意 | `https://<本番ドメイン>` | 共有カード（OGP）の絶対URL。未設定なら Vercel が渡す本番ドメインを使う |

**画面操作:**

1. プロジェクト →「**Settings**」→「**Environment Variables**」
2. Key に `GEMINI_API_KEY`、Value にAPIキーを入力
3. Environment は `Production` `Preview` `Development` すべてにチェック
4. 「**Save**」→ 反映には**再デプロイが必要**（4章参照）

**コマンド:**

```bash
vercel env add GEMINI_API_KEY production
# プロンプトにAPIキーを貼り付ける
```

> APIキーはサーバ側（`src/app/api/chat/route.ts`）でしか読まない。ブラウザには渡らない。
> `NEXT_PUBLIC_` の付いた変数だけがブラウザに露出するので、**APIキーにこの接頭辞を付けてはいけない**。

### 3.3. カスタムドメイン（任意）

1. プロジェクト →「**Settings**」→「**Domains**」→ ドメインを追加
2. 独自ドメインを設定した場合は、`NEXT_PUBLIC_SITE_URL` をそのドメインに更新して再デプロイする（共有カードの画像URLが変わるため）

---

## 4. デプロイ後の確認

公開URLを `$URL` として、以下をすべて通す。**提出前は必ず全部見る。**

| # | 確認すること | 見かた |
| :--- | :--- | :--- |
| 1 | トップが出る | `$URL/` |
| 2 | ごみ分別が引ける | `$URL/gomi?m=tachikawa&q=アイロン台` → 「粗大ごみ」「100円」 |
| 3 | 犯罪認知件数が出る | `$URL/bouhan?a=西新宿７丁目` → 件数と前年比 |
| 4 | **地図が描かれる**（点まで） | `$URL/manabi?m=中野区` → 地図に緑の点。**タイルだけ出て点が無いならワーカー配置の失敗** |
| 5 | バリアフリーが絞れる | `$URL/barrierfree?f=ostomate&c=station` → 一覧と地図 |
| 6 | チャットが答える | `$URL/chat?q=アイロン台を捨てたい` → 区市町村を聞き返す |
| 7 | **Gemini が効いている** | 上の回答に「キーワード判定（APIキー未設定）」と出て**いない**こと |
| 8 | 共有カードが出る | `$URL/opengraph-image.png` が 1200×630 で開く。SlackにURLを貼って絵が出るか |
| 9 | タブのアイコン | `$URL/icon.svg` が開く。ブラウザのタブに道しるべの印が出る |

**ログの見かた（画面操作）:**

1. プロジェクト →「**Deployments**」→ 対象のデプロイをクリック
2. 「**Build Logs**」でビルド時のエラー、「**Runtime Logs**」で実行時のエラーを見る

**コマンド:**

```bash
vercel logs <deployment-url>
```

---

## 5. 2回目以降の更新

1. `main` に変更をマージする（またはpushする）
2. Vercel が自動でビルド・デプロイする（GitHub連携をしている場合）
3. 4章の確認を行う

**環境変数だけを変えた場合は自動では反映されない。** 再デプロイが必要:

- **画面操作**: 「Deployments」→ 最新のデプロイの「⋮」→「**Redeploy**」
- **コマンド**: `vercel --prod --force`

### ロールバック

- **画面操作**: 「Deployments」→ 戻したいデプロイの「⋮」→「**Promote to Production**」
- **コマンド**: `vercel rollback <deployment-url>`

> 生成JSONもリポジトリに入っているので、**ロールバックすればデータもその時点に戻る**。
> 取り込みの失敗を本番に出してしまった場合も、1操作で戻せる。

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
| 地図のタイルは出るが**点が1つも描かれない** | MapLibre のワーカーが `public/maplibre/` に無い。`prebuild`（`scripts/copy-map-worker.mjs`）が走っているかビルドログで確認する |
| チャットに「キーワード判定（APIキー未設定）」と出る | `GEMINI_API_KEY` が Vercel 側で未設定か、設定後に再デプロイしていない |
| Slack に貼っても画像が出ない | `NEXT_PUBLIC_SITE_URL` が実際の公開ドメインと違う。または `src/app/opengraph-image.png` がコミットされていない |
| 公開されている数字が古い | 生成JSONのコミット漏れ。`git status` で `src/data/generated/` を確認する |
| ビルドが型エラーで落ちる | 手元で `npx tsc --noEmit` が通っているか。Vercel はビルド時に型検査も行う |

---

## 8. この構成で「やらない」と決めたこと

| 項目 | 理由 |
| :--- | :--- |
| 外部DB（Supabase等）を置く | データは数万件だが読み取り専用で、静的JSONで足りる。無料枠の自動サスペンドで当日落ちるリスクを排除する |
| 実行時にオープンデータを取得する | 公開CSVの更新は月〜年の単位でしか動かないためリアルタイムにならず、**壊れたデータを止める検証の門を失うだけ**になる |
| OGP画像を実行時に生成する | 日本語フォントを実行時に用意しないと文字がすべて豆腐になる。フォントの配信元に当日の成否を握らせない（画像は静的PNGをコミット） |
