/**
 * 検索の純関数のテスト。
 *
 * 取り込み側はビルド時の検証が手厚い（列ズレ・小計突合・疎通確認）が、
 * **検索側は壊れても静かに壊れる。** 0件になるだけで例外は出ないので、
 * 見ている人が「そのデータは無いのだろう」と誤読する。ここで止める。
 *
 * 取り込み済みの実データをそのまま使う。作り物のデータでは、
 * 「公式の品目名が `飲料容器（ペットボトル）` である」ような**現実の形**を検証できない。
 *
 *   node --import tsx --test src/lib/search.test.ts
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getLink } from '@/data/links';
import { searchBarrierFree } from './barrierfree/search';
import { searchBouhan } from './bouhan/search';
import { itemFromText, searchGomi } from './gomi/search';
import { searchManabi } from './manabi/search';
import { townFromText } from './ai/route-query';
import type { AnswerResult } from '@/types/answer';

/** 共通画面契約（設計書 §3）。答えられても答えられなくても、②〜④は必ず埋まっている */
function assertContract(result: AnswerResult, label: string) {
  assert.ok(result.provenance.sourceName, `${label}: 出典が無い`);
  assert.ok(result.provenance.sourceUrl.startsWith('http'), `${label}: 出典URLが不正`);
  assert.ok(result.provenance.asOf, `${label}: 時点が無い`);
  assert.ok(result.provenance.coverage, `${label}: カバー範囲が無い`);
  assert.ok(result.limitations.length > 0, `${label}: できないことが空`);
  assert.ok(result.escalations.length > 0, `${label}: 公式への出口が空`);
  for (const escalation of result.escalations) {
    assert.ok(escalation.reason, `${label}: 出口の発火理由が空`);
    // 出口は「キュレーションDBのID」か「取り込み時に疎通確認したURL」のどちらか。
    // IDの側は、実在しないIDを指していないことをここで確かめる
    const url = escalation.linkId ? getLink(escalation.linkId)?.url : escalation.link.url;
    assert.ok(url?.startsWith('http'), `${label}: 出口のURLが不正`);
  }
}

describe('ごみ分別', () => {
  it('部分一致で引ける（公式の品目名は「飲料容器（ペットボトル）」）', () => {
    const result = searchGomi({ item: 'ペットボトル', municipality: 'tachikawa' });
    assert.notEqual(result.answer, null);
    assert.match(result.answer!.subject, /ペットボトル/);
    assertContract(result, 'ペットボトル');
  });

  it('かなで引ける（中野区はカナ列を持っている）', () => {
    const result = searchGomi({ item: 'あいすぴっく', municipality: 'nakano' });
    assert.notEqual(result.answer, null);
    assert.match(result.answer!.subject, /アイスピック/);
  });

  it('粗大ごみは申込みを代行せず、手続きの出口を出す', () => {
    const result = searchGomi({ item: 'アイロン台', municipality: 'tachikawa' });
    assert.notEqual(result.answer, null);
    assert.match(result.answer!.headline, /粗大/);
    assert.ok(
      result.escalations.some((e) => e.kind === 'procedure'),
      '粗大ごみなのに手続きの出口が無い',
    );
    assertContract(result, 'アイロン台');
  });

  it('分別区分は自治体の公式表記のまま出す（「可燃ごみ」等へ正規化しない）', () => {
    const result = searchGomi({ item: '生ごみ', municipality: 'nakano' });
    assert.notEqual(result.answer, null);
    // 中野区の公式表記は「燃やすごみ」。ここが「可燃ごみ」になっていたら正規化が漏れている
    assert.doesNotMatch(result.answer!.headline, /^可燃/);
  });

  it('未対応の自治体は、答えずに範囲外の出口へ送る', () => {
    const result = searchGomi({ item: 'ペットボトル', municipality: '渋谷区' });
    assert.equal(result.answer, null);
    assert.ok(result.escalations.some((e) => e.kind === 'out_of_scope'));
    assertContract(result, '渋谷区');
  });

  it('載っていない品目は「無い」と断定せず、公式へ送る', () => {
    const result = searchGomi({ item: 'ぜったいにそんざいしないひんもく', municipality: 'tachikawa' });
    assert.equal(result.answer, null);
    assertContract(result, '存在しない品目');
  });

  describe('itemFromText（AIが品目名を書き換えたときの取り直し）', () => {
    it('住民の文から実在する品目名を拾う', () => {
      assert.equal(itemFromText('アイロン台を捨てたい', 'tachikawa'), 'アイロン台');
    });

    it('括弧の中だけを書いても拾う（公式名は「飲料容器（ペットボトル）」）', () => {
      assert.equal(itemFromText('ペットボトルってどう捨てるの？', 'tachikawa'), '飲料容器（ペットボトル）');
    });

    it('ごみの話でない文からは拾わない', () => {
      for (const text of ['西新宿７丁目の治安が知りたい', '車椅子で入れるお店を探したい', 'こんにちは']) {
        assert.equal(itemFromText(text, 'nakano'), undefined, text);
      }
    });
  });
});

describe('防犯', () => {
  it('町丁で引ける', () => {
    const result = searchBouhan({ area: '西新宿７丁目' });
    assert.notEqual(result.answer, null);
    assert.equal(result.matched?.municipality, '新宿区');
    assertContract(result, '西新宿７丁目');
  });

  it('漢数字で書いても同じ町丁に当たる（AIが書き換えてくるため）', () => {
    const zenkaku = searchBouhan({ area: '西新宿７丁目' });
    const kanji = searchBouhan({ area: '西新宿七丁目' });
    assert.equal(kanji.matched?.town, zenkaku.matched?.town);
    assert.equal(kanji.matched?.total, zenkaku.matched?.total);
  });

  it('区市町村名でも引ける', () => {
    const result = searchBouhan({ area: '立川市' });
    assert.notEqual(result.answer, null);
    assertContract(result, '立川市');
  });

  it('前年に同名の行が無い町丁には増減を出さない', () => {
    // 町丁の一覧は年で入れ替わる。前年比は「出せるときだけ出す」
    const result = searchBouhan({ area: '西新宿７丁目' });
    const yoy = result.answer?.facts.find((f) => f.label.includes('前年'));
    if (yoy) assert.doesNotMatch(yoy.value, /%|％/, '町丁の前年比に割合を出してはいけない');
  });

  it('存在しない地名は「無い」と断定せず、公式へ送る', () => {
    const result = searchBouhan({ area: 'そんざいしないちょうちょう' });
    assert.equal(result.answer, null);
    assertContract(result, '存在しない町丁');
  });

  describe('townFromText（AIが地名を書き換えたときの取り直し）', () => {
    it('住民の文から町丁名をそのまま抜く', () => {
      assert.equal(townFromText('西新宿７丁目の治安が知りたい'), '西新宿７丁目');
      assert.equal(townFromText('丸の内一丁目はどう？'), '丸の内一丁目');
    });

    it('町丁名が無ければ何も返さない', () => {
      assert.equal(townFromText('ペットボトルってどう捨てるの？'), undefined);
    });
  });
});

describe('学びと体験の場', () => {
  it('区市町村と種別で絞り込める', () => {
    const result = searchManabi({ municipality: '中野区', kinds: ['図書館'] });
    assert.ok(result.facilities.length > 0);
    assert.ok(
      result.facilities.every((f) => f.m === '中野区'),
      '中野区以外の施設が混ざっている',
    );
    assertContract(result, '中野区の図書館');
  });

  it('絞り込みが0件でも契約は満たす', () => {
    const result = searchManabi({ municipality: '中野区', q: 'そんざいしないしせつ' });
    assert.equal(result.facilities.length, 0);
    assertContract(result, '0件');
  });

  it('地図に出せない施設の数を隠さない', () => {
    const result = searchManabi({});
    assert.equal(
      result.noCoordsCount,
      result.facilities.filter((f) => f.lat === undefined || f.lon === undefined).length,
    );
  });
});

describe('バリアフリー', () => {
  it('条件を指定すると、yesと明記された場所だけが残る', () => {
    const result = searchBarrierFree({ features: ['wheelchair_entry'], category: 'restaurant' });
    assert.ok(result.spots.length > 0);
    assert.ok(
      result.spots.every((spot) => spot.f.wheelchair_entry === 'yes'),
      '「未記入」の場所が条件付き検索に混ざっている',
    );
    assertContract(result, '車椅子で入れる飲食店');
  });

  it('「未記入」を「無い」に潰さない（3値で持つ）', () => {
    const result = searchBarrierFree({ category: 'restaurant' });
    const coverage = result.coverage.find((c) => c.key === 'accessible_toilet');
    assert.ok(coverage, 'カバー率が出ていない');
    assert.ok(coverage!.unknown > 0, '未記入が0件になっている（3値が潰れている可能性）');
  });
});
