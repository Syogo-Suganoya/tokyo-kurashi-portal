'use client';

/**
 * 区市町村の聞き返し（設計書 §4.3）。
 *
 * 対応が29自治体に増え、選択肢を全部ボタンで並べると32個になって圧が強くなった。
 * 覚えているものだけをボタンで出し、それ以外は一覧から選ぶ形にする。
 * 覚えている区市町村があるときは、そもそもこの画面が出ない（聞き返さずに答える）。
 */

import { useState } from 'react';

import { MUNICIPALITIES } from '@/data/municipalities';
import { MAX_SAVED, useSavedMunicipalities } from '@/lib/use-saved-municipalities';

function nameOf(code: string): string {
  return MUNICIPALITIES.find((m) => m.code === code)?.name ?? code;
}

export function MunicipalityPicker({ onPick }: { onPick: (code: string) => void }) {
  const { saved, ready, remember, forget, isFull } = useSavedMunicipalities();
  const [selected, setSelected] = useState('');
  const [shouldRemember, setShouldRemember] = useState(true);

  function pick(code: string, alsoRemember: boolean) {
    if (alsoRemember) remember(code);
    onPick(code);
  }

  return (
    <div className="mt-4">
      {ready && saved.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-muted">よく使う区市町村</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {saved.map((code) => (
              <span key={code} className="inline-flex overflow-hidden rounded-lg border border-line">
                <button
                  type="button"
                  onClick={() => pick(code, false)}
                  className="px-4 py-2 text-sm font-bold text-accent hover:bg-accent-soft"
                >
                  {nameOf(code)}
                </button>
                <button
                  type="button"
                  onClick={() => forget(code)}
                  aria-label={`${nameOf(code)}を覚えておくのをやめる`}
                  className="border-l border-line px-2 text-sm text-muted hover:bg-background"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <label className="block min-w-0 flex-1">
          <span className="text-xs font-semibold text-muted">
            {ready && saved.length > 0 ? 'ほかの区市町村から選ぶ' : '区市町村を選ぶ'}
          </span>
          <select
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-background px-3 py-2"
          >
            <option value="">選択してください</option>
            {MUNICIPALITIES.map((m) => (
              <option key={m.code} value={m.code}>
                {m.name}
                {m.supported ? '' : '（未対応）'}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={!selected}
          onClick={() => pick(selected, shouldRemember && !isFull)}
          className="rounded-lg bg-accent px-5 py-2 font-semibold text-surface disabled:opacity-40"
        >
          これで調べる
        </button>
      </div>

      <label className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-muted">
        <input
          type="checkbox"
          checked={shouldRemember && !isFull}
          disabled={isFull}
          onChange={(event) => setShouldRemember(event.target.checked)}
          className="mt-0.5"
        />
        <span>
          {isFull
            ? `覚えておけるのは${MAX_SAVED}つまでです。増やすには上の ✕ でどれかを外してください。`
            : `この端末に覚えておく（${MAX_SAVED}つまで）。次からは聞き返さずにお答えします。サーバには送りません。`}
        </span>
      </label>
    </div>
  );
}
