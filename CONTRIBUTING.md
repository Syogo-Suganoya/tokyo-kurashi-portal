# 開発の手引き

このリポジトリを触るときの手順と約束をまとめる。
何を作っているかは [README.md](README.md) を、残っている作業は [TODO.md](TODO.md) を見る。

## 必要なもの

- Node.js 20.9 以上（Next.js 16 の要件）。開発時の実績は v26.7.0 / npm 11.19.0
- Cloudflare アカウント（チャットの分野判定を手元で動かすときだけ。無くても全画面が動く）

## セットアップ

```bash
npm install
npm run dev
```

**APIキーの設定は無い。** 分野判定は Cloudflare Workers AI で行い、`AI` バインディング経由で呼ぶ
（`wrangler.jsonc` を参照）。手元の `next dev` でも `next.config.ts` の `initOpenNextCloudflareForDev()`
がバインディングを繋ぐので、`npx wrangler login` さえ済んでいれば効く。

繋がらないときは、分野判定がキーワード一致のフォールバックに落ちる。
画面には「キーワード判定（理由）」と出る。**画面が死ぬことはない**が、判定の質は落ちる。

## コミット前に通すもの

```bash
npm run lint
npm run check:types
npm test               # 検索の純関数（実データで引く）
npm run preview        # workerd で実際に動かす（http://localhost:8788）
```

`npm run dev` は素の Next.js で動くので、**本番と動く場所が違う**。
バインディングやランタイムの差が絡む変更をしたら `preview` まで通す。

`check:types` は先に `next typegen` を走らせる。`PageProps` / `LayoutProps` は Next.js が
生成する型なので、**クローン直後や `.next` を消した後は生成しないと型検査が落ちる**。

型検査が2本に分かれているのは、アプリ（Cloudflare Workers）と取り込みスクリプト（Node）で
実行環境が本当に違うため。workerd の型は `Buffer` などのグローバルを自前で宣言していて、
@types/node と衝突する。`check:types` が両方をまとめて走らせる。

## リポジトリの地図

```
src/
  types/answer.ts       共通画面契約。**ここが設計の核心**
  types/glyph.ts        図記号の名前
  components/           AnswerCard / PointMap / Pictogram など
  data/links.ts         案内先URLのキュレーションDB（27件）
  data/generated/       取り込み済みの静的JSON。**手で編集しない**
  lib/<画面>/search.ts  検索の純関数。AI tool use の実体でもある
  lib/<画面>/types.ts   その画面のデータ型と、データ特有の注意書き
  lib/ai/               ツール定義と分野判定（Workers AI）
  app/                  画面（/gomi /bouhan /manabi /barrierfree /chat）
scripts/                取り込みスクリプトと検証
assets/                 OGP画像・アイコンのSVG原本
docs/                   構成図（architecture.py / .png）と調査データ
wrangler.jsonc          Worker名・AIバインディング・使うモデル
.github/workflows/      main への push で Cloudflare へデプロイする CD
open-next.config.ts     Next.js を Workers に載せるための設定
cloudflare-env.d.ts     **生成物**。`npm run cf-typegen` で作り直してコミットする
```

`src/lib/*/types.ts` には、**実データを検証して分かった地雷**がコメントで残してある。
その画面を触る前に読む。たいてい「なぜこんな回りくどい書き方なのか」の答えがそこにある。

## 型で守っていること

以下は規約ではなく**コンパイルエラー**になる。守るのではなく、破れないようにしてある。

| 守っていること | 仕組み |
| :--- | :--- |
| 出典・時点・カバー範囲を書き忘れた画面を作れない | `AnswerCard` の必須プロパティ |
| 「この画面でできないこと」が空の画面を作れない | `limitations: NonEmpty<string>`（非空タプル） |
| 公式への出口が無い画面を作れない | `escalations: NonEmpty<Escalation>` |
| 実在しない案内先URLを画面に出せない | `LinkId` はキュレーションDBのキーから生成した union |
| 存在しない図記号を指定できない | `GlyphName` は名前の union |
| AIが知らない施設区分・設備キーを渡せない | ツール定義の `enum` を取り込み済みデータから生成している |

**これらを緩める変更は単独でやらない。**
行政情報を扱うサービスとして、ここが緩むと全体の主張が成り立たなくなる。

## 変更するときの約束

- **答えの本文は行政のオープンデータそのまま。** 生成AIに文章を書かせない
- **分別区分などのラベルは自治体の公式表記のまま出す。** 「可燃ごみ」等へ勝手に正規化しない（ごみ袋やカレンダーの表記と食い違う）。正規化キーは図記号と横断検索の内部処理にだけ使う
- **申請・予約・申込みは代行しない。** 住民に責任が生じる行為は必ず公式の窓口へ送る
- **「なし」と断定しない。** 元データが空欄なのは「無い」ではなく「書かれていない」。3値で持つ（`src/lib/barrierfree/types.ts`）
- **絵文字を画面に出さない。** 端末ごとに絵柄も線の太さも変わる。図記号は `components/Pictogram.tsx` に足す
- **AIの出力をそのまま信じない。** ツール名も引数も `toRoutedQuery` で絞り込んでから使う（`src/lib/ai/route-query.ts`）

## AI（Workers AI）

分野判定は `src/lib/ai/route-query.ts`。AIがやるのは**どのツールをどんな引数で呼ぶか**の決定だけで、
住民に見せる文章は1文字も作らせない。

- モデルは `wrangler.jsonc` の `vars.WORKERS_AI_MODEL`。**function calling に対応したものを選ぶ**。
  対応していても**まともに選べないモデルがある**（`llama-4-scout` は10問中6問）ので、替えるなら実測する
- ツール呼び出しは**形も置き場所もモデルによって違う**。`normalizeToolCall` が形を、`toolCallsOf` が
  置き場所を吸収する
  - 素の `{name, arguments}` ／ OpenAI形式 `{function: {name, arguments}}`（引数はJSON文字列）
  - 応答の直下 `tool_calls` ／ OpenAI互換の `choices[].message.tool_calls`（`gpt-oss-120b` で実測）
- 失敗したら1度だけ投げ直す。Workers AI は時々「3044: Unknown internal error」を返す
- 判定を揺らしたくないので `temperature: 0` で呼ぶ
- 繋がらない・ツールが選ばれない・引数が壊れている、のどれでもキーワード判定へ落ちる。
  **どの経路で答えたかは必ず画面に出す。** AIが落ちていることを隠さない

**モデルは入力の言葉を書き換えてくる。** 地名も品目名も書き換わる。
実測したもの：「西新宿７丁目」→「七丁目」「七丁**部**」「七野」「七金目」、「アイロン台」→「アイロン**天**」。
プロンプトで禁じても直らないので、受け取る側で吸収する。

1. `src/lib/text.ts` … 漢数字の丁目を数字に畳む（「七丁目」→「7丁目」）。規則的なずれはここで消える
2. `src/app/api/chat/route.ts` … それでも0件なら、**住民が書いた文から取り直して引き直す**
   （`townFromText` ／ `itemFromText`）。別の語に化けたものはここで拾う

モデル選びでも効く。`@cf/qwen/qwen3-30b-a3b-fp8` は3試行とも書き換えなかったが、
前に使っていた `@cf/meta/llama-3.3-70b-instruct-fp8-fast` は**3試行とも**書き換えた。
それでも取り直しの経路は残す。次のモデルが同じとは限らない。

## データの取り込み

オープンデータの取り込みは**ビルド時**に行い、生成した静的JSONをコミットする。
実行時に都や区市町村のサーバを叩かないので、公開側の障害や遅延がこちらの障害にならず、
壊れたデータは住民の画面に出る前にビルドで止まる。

```bash
npm run build:data     # 全データを取り込み直す（gomi + bouhan + manabi + barrierfree）
npm run check:data     # 元データが更新されていないかだけを確認する
```

`check:data` は生成JSONに残した ETag / Last-Modified で条件付きリクエストを投げるだけなので安価。
更新を検知すると**終了コード 2** を返す。

| 簡易版 | 画面 | データ源 | 規模 |
| :--- | :--- | :--- | :--- |
| ごみ分別 | `/gomi` | 東京都オープンデータカタログ（自治体別CSV） | 31自治体・28,815品目 |
| 防犯 | `/bouhan` | 警視庁 町丁別・罪種別認知件数（年累計） | 令和7年・5,142町丁（前年比に令和6年も） |
| 学びと体験の場 | `/manabi` | 東京都教育庁 施設関連情報（9種別） | 849施設・地図表示 |
| バリアフリー | `/barrierfree` | 産業労働局・福祉局・交通局（7本） | 6,278か所 |

取り込みには検証が入っている。**落ちたときは直さずに止める**のが正しい。
落ちたということは公開側のCSVの形が変わったということで、古いJSONのまま公開し続ける方が安全。

- 列ズレの検出（分別区分の異なり数が行数に近ければ列がずれている）
- 区市町村ごとの合計を、CSV自身の「○○計」行と突合
- 案内先URLの疎通確認
- 年をまたぐ突合率の下限（`/bouhan`）

### ごみ分別の自治体を足す

取り込み対象は `scripts/gomi-sources.ts` にあり、`npx tsx scripts/discover-gomi-sources.ts` の出力を貼って作る。
全数調査の結果にカタログの公式ページURLを突き合わせ、CSVと案内先の両方に疎通確認を通したものだけが残る。

列名は「**候補の配列**」で書く。最初に中身が入っていた列が採用される。
公開CSVには**列が存在するのに全件空**、というものが実在するため（立川市の `注意点` 列など）。

## 図記号を足す

1. `src/types/glyph.ts` の union に名前を足す
2. `src/components/Pictogram.tsx` の `GLYPHS` に24×24のパスを書く（`fill` なし・`stroke-width` 1.8）
3. 足りなければ `tsc` が落ちる（`Record<GlyphName, …>` なので網羅が必須）

**既にある図記号と似た形になっていないか必ず見る。** 見分けるための記号なので、似ていたら意味がない。
図記号だけで意味が伝わることは期待しない。隣に必ず言葉を置き、図記号は `aria-hidden` で読み上げから外す。

## 地図

`components/PointMap.tsx` を `/manabi` と `/barrierfree` で共有している。
背景は国土地理院の淡色地図タイル。APIキーも利用登録も要らず、出典表示は `attribution` に入れている（利用規約上の義務）。

**MapLibre のワーカーは `public/maplibre/` に置く必要がある**（`predev` / `prebuild` が `scripts/copy-map-worker.mjs` で配置する）。
これが無いと、地図タイルは出るのに点だけが永久に描かれない。Turbopack が既定のワーカーURLを解決できないため。

## OGP画像・アイコンを作り直す

```bash
brew install librsvg      # rsvg-convert が要る（このスクリプトを走らせるときだけ）
node scripts/build-og-image.mjs
```

`assets/*.svg` を元に `src/app/opengraph-image.png` と `apple-icon.png` を作り、**PNGをコミットする**。
ビルドには繋いでいない。`next/og` の実行時生成は日本語フォントを別に用意しないと文字がすべて豆腐になり、
フォントを取りに行く処理をビルドに足すと「ビルド時に外部へ取りに行かない」という他の作りと食い違うため。

文字は実行環境のフォント（ヒラギノ）で描かれるので、**作り直したら出来上がりを目で見る**。

## `wrangler.jsonc` を変えたら

```bash
npm run cf-typegen     # cloudflare-env.d.ts を作り直す
```

バインディングや `vars` を足したのに型が付かないときは、これを忘れている。
生成された `cloudflare-env.d.ts` は**コミットする**（無いと型検査が通らない）。

**`.open-next/` がある状態で生成しないこと。** あると `WORKER_SELF_REFERENCE` の型が
`.open-next/worker` を指す形になり、ビルド前に型検査を走らせる場面（CIのビルドジョブ）で
参照先が無くて落ちる。`rm -rf .open-next` してから生成する。

## テスト

```bash
npm test               # tsx --test。CIのビルドジョブでも走る
```

`src/lib/search.test.ts` に検索の純関数のテストがある。**取り込み済みの実データをそのまま使う。**
作り物のデータでは「公式の品目名が `飲料容器（ペットボトル）` である」ような現実の形を検証できない。

見ているのは、壊れても例外が出ずに**静かに0件になる**ところ。部分一致・かな検索・3値の扱い・
漢数字の丁目・AIが言葉を書き換えたときの取り直し、そして**共通画面契約が常に埋まっていること**。

## キーボードと読み上げ

- **見出しの階層を飛ばさない。** 答えは `h2`、答えの中の区切りは `h3`。
  読み上げで見出しを辿る人が、最初に答えに着くようにするため
- **焦点のリングは自分で描く**（`globals.css` の `:focus-visible`）。既定任せにしない
- 検索フォームの前に「結果へ移動」を置く（`components/SkipToAnswer.tsx`）。
  飛び先には `tabIndex={-1}` が要る。無いと画面が動くだけで、次のTabがフォームの先頭に戻る
- 入力は `<label>` で包むか `id`／`for` で結ぶ。**プレースホルダはラベルの代わりにならない**
- 図記号は `aria-hidden`。隣に必ず言葉を置く

## まだ無いもの

- 実機のスクリーンリーダー（VoiceOver / NVDA）での通し確認。**今あるのは構造の確認まで**

残っている作業は [TODO.md](TODO.md) にある。
