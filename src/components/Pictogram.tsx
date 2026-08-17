/**
 * 簡易版4本の図記号。
 *
 * 案内標識のピクトグラムに寄せた線画にしている。絵文字ではなく線画にしたのは、
 * 分野の色帯と同じ太さ・同じ描き味で並べたいため。装飾ではなく見分けるための記号。
 */

const BASE = 'h-7 w-7';

export type ToolIcon = 'gomi' | 'bouhan' | 'manabi' | 'barrierfree';

export function Pictogram({ name }: { name: ToolIcon }) {
  const common = {
    className: BASE,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  if (name === 'gomi') {
    // ごみ箱
    return (
      <svg {...common}>
        <path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 12.5h9L17.5 7" />
        <path d="M10 11v5M14 11v5" />
      </svg>
    );
  }
  if (name === 'bouhan') {
    // 集計の棒グラフ。盾にすると「危険」の印象を与えるため、あくまで数字の画面だと示す
    return (
      <svg {...common}>
        <path d="M4 20h16" />
        <path d="M7 20v-6M12 20V6M17 20v-9" />
      </svg>
    );
  }
  if (name === 'manabi') {
    // 開いた本
    return (
      <svg {...common}>
        <path d="M12 6.5C10.5 5 8 4.5 4 5v13c4-.5 6.5 0 8 1.5 1.5-1.5 4-2 8-1.5V5c-4-.5-6.5 0-8 1.5Z" />
        <path d="M12 6.5v13" />
      </svg>
    );
  }
  // 車椅子
  return (
    <svg {...common}>
      <circle cx="9.5" cy="17" r="4" />
      <circle cx="13" cy="4.5" r="1.6" />
      <path d="M13 8v5h4l3 5" />
      <path d="M13 13H9.5" />
    </svg>
  );
}
