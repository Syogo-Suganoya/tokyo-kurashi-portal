'use client';

/**
 * よく使う区市町村を、その端末にだけ覚えておく。
 *
 * ログインは作らない。ごみの分別を引くのに必要なのは「どこに住んでいるか」だけで、
 * それを預かるためにアカウントを作らせるのは釣り合わない。
 * 保存先は localStorage（この端末のブラウザ内）で、サーバには送らない。
 *
 * 対応自治体が29に増えて、聞き返しの選択肢が32個並ぶようになったのが直接の動機。
 * ただし本当の狙いは選択肢を減らすことではなく、**覚えていれば聞き返さずに済ませる**こと。
 *
 * localStorage はReactの外にある状態なので `useSyncExternalStore` で読む。
 * 効果の中で setState して読み込むやり方だと、別のタブで変更されたときに追従できず、
 * サーバ描画との食い違いも自分で面倒を見ることになる。
 */

import { useCallback, useSyncExternalStore } from 'react';

import { MUNICIPALITIES } from '@/data/municipalities';

const STORAGE_KEY = 'kurashi.municipalities';

/** 覚えておく上限。引っ越し前後や実家との比較を考えると3つあれば足りる */
export const MAX_SAVED = 3;

/** サーバ描画時と、保存が無いときに返す。毎回同じ配列を返さないと再描画が止まらない */
const EMPTY: string[] = [];

const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cachedValue: string[] = EMPTY;

/** 保存されているのが今も選べる区市町村かを確かめる。対応が変わっても壊れないように */
function sanitize(codes: unknown): string[] {
  if (!Array.isArray(codes)) return [];
  const known = new Set(MUNICIPALITIES.map((m) => m.code));
  return [...new Set(codes.filter((c): c is string => typeof c === 'string' && known.has(c)))].slice(
    0,
    MAX_SAVED,
  );
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  // 別のタブで変更されたときも追従する
  window.addEventListener('storage', onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onChange);
  };
}

/** 中身が変わっていないときは同じ配列を返す。返す度に新しい配列を作ると無限に再描画される */
function getSnapshot(): string[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return EMPTY;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      cachedValue = sanitize(JSON.parse(raw ?? '[]'));
    } catch {
      // 保存が壊れていても、保存が無いのと同じ扱いにする
      cachedValue = EMPTY;
    }
  }
  return cachedValue;
}

function getServerSnapshot(): string[] {
  return EMPTY;
}

function write(codes: string[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(codes));
  } catch {
    // プライベートモード等で保存できないことがある。保存できなくても操作は続けられる
  }
  for (const listener of listeners) listener();
}

export function useSavedMunicipalities() {
  const saved = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  /**
   * 画面に描かれ終わったか。サーバ側では localStorage を読めないので最初は必ず空になる。
   * 読み込み前に「保存はありません」と出すとちらつくため、済むまで何も出さない。
   */
  const ready = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  const remember = useCallback((code: string) => {
    // 選んだものを先頭に置く。次に来たときの既定になる
    write(sanitize([code, ...getSnapshot()]));
  }, []);

  const forget = useCallback((code: string) => {
    write(getSnapshot().filter((c) => c !== code));
  }, []);

  return { saved, ready, remember, forget, isFull: saved.length >= MAX_SAVED };
}
