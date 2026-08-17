'use client';

/**
 * `/gomi` の上に出す、覚えている区市町村への近道。
 *
 * チャットで覚えたものをここでも使えるようにする。覚えた場所と使える場所が違うと、
 * 覚えさせた意味が半分になる。
 * 保存は端末の中だけにあるので、この部分だけクライアントで描く。
 */

import Link from 'next/link';

import { MUNICIPALITIES } from '@/data/municipalities';
import { useSavedMunicipalities } from '@/lib/use-saved-municipalities';

export function SavedMunicipalityLinks({ current }: { current: string }) {
  const { saved, ready } = useSavedMunicipalities();

  // 読み込み前は何も出さない。「保存はありません」が一瞬見えるのを避ける
  if (!ready || saved.length === 0) return null;

  return (
    <p className="mt-3 flex flex-wrap items-center gap-2 text-sm">
      <span className="text-xs font-semibold text-muted">よく使う区市町村</span>
      {saved.map((code) => {
        const name = MUNICIPALITIES.find((m) => m.code === code)?.name ?? code;
        const isCurrent = code === current;
        return (
          <Link
            key={code}
            href={`/gomi?m=${code}`}
            aria-current={isCurrent ? 'page' : undefined}
            className={`rounded-lg border px-3 py-1 text-sm font-bold ${
              isCurrent
                ? 'border-transparent bg-accent text-surface'
                : 'border-line text-accent hover:border-accent'
            }`}
          >
            {name}
          </Link>
        );
      })}
    </p>
  );
}
