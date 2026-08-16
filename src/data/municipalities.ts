/**
 * 自治体レジストリ（ごみ分別簡易版）
 *
 * **未対応の自治体も明示的に持つ**のが要点。
 * 対応していない自治体を選択肢から隠すのではなく、選べるようにした上で
 * 「まだ対応していません」と限界を示して公式へ送る（設計書 §5「範囲外」）。
 * カバー範囲を偽らないという設計を、選択肢の作り方の段階から守る。
 */

import type { LinkId } from './links';

export type SupportedMunicipality = {
  code: string;
  name: string;
  supported: true;
  /** 鮮度エスカレーションの送り先（自治体のごみ情報トップ） */
  officialLinkId: LinkId;
  /** 手続きエスカレーションの送り先（粗大ごみ受付） */
  sodaiLinkId: LinkId;
  /** 品目が見つからなかったときの送り先 */
  notFoundLinkId: LinkId;
};

export type UnsupportedMunicipality = {
  code: string;
  name: string;
  supported: false;
  /** 範囲外エスカレーションの送り先 */
  officialLinkId: LinkId;
};

export type Municipality = SupportedMunicipality | UnsupportedMunicipality;

export const MUNICIPALITIES: Municipality[] = [
  {
    code: 'tachikawa',
    name: '立川市',
    supported: true,
    officialLinkId: 'tachikawa-gomi-top',
    sodaiLinkId: 'tachikawa-sodai',
    notFoundLinkId: 'tachikawa-gomi-top',
  },
  {
    code: 'nakano',
    name: '中野区',
    supported: true,
    officialLinkId: 'nakano-gomi-top',
    sodaiLinkId: 'nakano-sodai',
    // 中野区には公式チャットボットがあるので、品目が見つからないときはそちらへ送る
    notFoundLinkId: 'nakano-gomi-chatbot',
  },
  {
    // 未対応。渋谷区はごみ品目のオープンデータを公開していないため取り込めない。
    // 隠さずに選べるようにして、範囲外エスカレーションを実際に見せる（設計書 §7.2）
    code: 'shibuya',
    name: '渋谷区',
    supported: false,
    officialLinkId: 'shibuya-gomi-hinmoku',
  },
];

/** 東京都の区市町村数（23区＋26市＋5町＋8村）。カバー範囲を実数で書くために使う */
export const TOKYO_MUNICIPALITY_COUNT = 62;

/** docs/gomi_taiou_jichitai.json で取り込み可能と確認済みの自治体数 */
export const SURVEYED_MUNICIPALITY_COUNT = 30;

export function findMunicipality(codeOrName: string): Municipality | undefined {
  return MUNICIPALITIES.find((m) => m.code === codeOrName || m.name === codeOrName);
}
