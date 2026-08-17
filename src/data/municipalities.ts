/**
 * 自治体レジストリ（ごみ分別簡易版）
 *
 * 対応自治体は**取り込み済みデータから導く**。29自治体を手で書き写すと、
 * 取り込み設定と一覧がすぐにずれるためである。案内先のURLも取り込み時に
 * 疎通確認済みのものがデータに入っているので、ここで持つ必要がない。
 *
 * 未対応の自治体だけを手で書く。**未対応であることには理由があり、
 * その理由は住民に見せる価値がある**（設計書 §5「範囲外」）。
 * 選択肢から隠さず、選べるようにした上で公式へ送る。
 */

import datasetJson from './generated/gomi.json';
import type { GomiDataset } from '@/lib/gomi/types';
import type { LinkId } from './links';

const dataset = datasetJson as GomiDataset;

export type SupportedMunicipality = {
  code: string;
  name: string;
  supported: true;
};

export type UnsupportedMunicipality = {
  code: string;
  name: string;
  supported: false;
  /** なぜ対応していないのか。住民にそのまま見せる */
  reason: string;
  /** 範囲外エスカレーションの送り先 */
  officialLinkId: LinkId;
};

export type Municipality = SupportedMunicipality | UnsupportedMunicipality;

/**
 * 対応していない自治体（2026-08-17 に全件を再調査した結果）。
 *
 * 残っているのは2区だけで、どちらも**こちらの都合ではなく公開側の状態**が理由。
 * 「まだ作っていない」ではなく「なぜ入れられないか」を書き、選択肢からも隠さない。
 *
 * 以前ここに入れていた世田谷区・東村山市は、再調査の結果いずれも対応できることが分かった。
 *   - 世田谷区：列名と中身が入れ替わっているだけで、どちらがどちらかはデータ自身が示していた
 *   - 東村山市：案内先が死んでいたのではなく、**こちらの名乗り方が弾かれていた**だけだった
 */
export const UNSUPPORTED_MUNICIPALITIES: UnsupportedMunicipality[] = [
  {
    code: 'shibuya',
    name: '渋谷区',
    supported: false,
    reason: '渋谷区は品目ごとのオープンデータを公開していないため、取り込めません。',
    officialLinkId: 'shibuya-gomi-hinmoku',
  },
  {
    code: 'taito',
    name: '台東区',
    supported: false,
    reason:
      '台東区のオープンデータは、カタログに登録されているCSVが区のサイト側で見つからない状態です（2026-08-17 時点、新旧2本とも）。誤ったデータをお見せしないよう、対応していません。',
    officialLinkId: 'taito-gomi',
  },
];

/** 対応自治体。取り込み済みデータから導くので、設定を増やせば自動で増える */
export const SUPPORTED_MUNICIPALITIES: SupportedMunicipality[] = dataset.municipalities.map((m) => ({
  code: m.code,
  name: m.name,
  supported: true,
}));

/** 画面の選択肢。対応・未対応を並べて出す */
export const MUNICIPALITIES: Municipality[] = [
  ...SUPPORTED_MUNICIPALITIES,
  ...UNSUPPORTED_MUNICIPALITIES,
].sort((a, b) => a.name.localeCompare(b.name, 'ja'));

/** 東京都の区市町村数（23区＋26市＋5町＋8村）。カバー範囲を実数で書くために使う */
export const TOKYO_MUNICIPALITY_COUNT = 62;

export function findMunicipality(codeOrName: string): Municipality | undefined {
  return MUNICIPALITIES.find((m) => m.code === codeOrName || m.name === codeOrName);
}
