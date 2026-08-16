/**
 * 取り込み元1本ぶんの「どこから・いつの・どの版か」の記録。
 *
 * 簡易版が増えるたびに鮮度チェックを書き足すのではなく、
 * どの取り込みスクリプトも生成JSONにこの形で足跡を残す。
 * `npm run check:data` は生成物からこれを拾うだけで全データ源を確認できる。
 */
export type SourceStamp = {
  /** 一意なID。`gomi:tachikawa` のように 簡易版:枝番 で付ける */
  id: string;
  /** 人が読むラベル */
  label: string;
  /** 取り込み元のURL（人向けページではなくCSVそのもの） */
  url: string;
  /** 条件付きリクエストに使う */
  etag?: string;
  /** 元データの更新日（HTTPの Last-Modified） */
  dataUpdatedAt?: string;
};
