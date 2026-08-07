import type { Config } from 'tailwindcss';

// ame-ui-philosophy 準拠: 8px グリッド / rounded-md,lg / --color-primary で 1ポイントカラー切替
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--color-primary)',
          foreground: 'var(--color-primary-foreground)',
        },
      },
      fontFamily: {
        sans: 'var(--font-ui)',
        serif: 'var(--font-ui-serif)',
        mono: 'var(--font-mono)',
      },
      borderRadius: {
        md: '0.375rem',
        lg: '0.5rem',
      },
      maxWidth: {
        prose: '65ch',
      },
    },
  },
  plugins: [],
} satisfies Config;
