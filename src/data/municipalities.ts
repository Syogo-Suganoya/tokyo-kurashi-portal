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
 * 対応していない自治体。
 * 渋谷区はデータが無く、世田谷区と台東区はデータに問題があって取り込めない（設計書 §2.2）。
 * 「まだ作っていない」ではなく「なぜ入れられないか」を書く。
 */
export const UNSUPPORTED_MUNICIPALITIES: UnsupportedMunicipality[] = [
  {
    code: 'shibuya',
    name: '渋谷区',
    supported: false,
    reason: '渋谷区はごみ品目のオープンデータを公開していないため、取り込めません。',
    officialLinkId: 'shibuya-gomi-hinmoku',
  },
  {
    code: 'setagaya',
    name: '世田谷区',
    supported: false,
    reason:
      '世田谷区の公開データは列と中身がずれており、そのまま取り込むと誤った分別区分になるため、あえて対応していません。',
    officialLinkId: 'setagaya-gomi',
  },
  {
    code: 'taito',
    name: '台東区',
    supported: false,
    reason: '台東区の公開データはリンクが切れており取得できないため、対応できていません。',
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

/** docs/gomi_taiou_jichitai.json で取り込み可能と確認済みの自治体数 */
export const SURVEYED_MUNICIPALITY_COUNT = 30;

export function findMunicipality(codeOrName: string): Municipality | undefined {
  return MUNICIPALITIES.find((m) => m.code === codeOrName || m.name === codeOrName);
}
