import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // 极简 Notion 风：以中性灰为主，蓝色点缀
        ink: {
          50: '#F9FAFB',
          100: '#F3F4F6',
          200: '#E5E7EB',
          300: '#D1D5DB',
          400: '#9CA3AF',
          500: '#6B7280',
          600: '#4B5563',
          700: '#374151',
          800: '#1F2937',
          900: '#111827',
        },
        accent: {
          50: '#F0F9FF',
          100: '#E0F2FE',
          500: '#0EA5E9',
          600: '#0284C7',
          700: '#0369A1',
        },
      },
      fontFamily: {
        // 用 Fraunces 衬线字作标题增加品味，IBM Plex Sans 作正文
        // 中文走系统中文字体回退，避免 latin 子集不支持 CJK
        serif: [
          'var(--font-fraunces)',
          'Georgia',
          '"PingFang SC"',
          '"Microsoft YaHei"',
          'serif',
        ],
        sans: [
          'var(--font-plex)',
          'system-ui',
          '"PingFang SC"',
          '"Microsoft YaHei"',
          'sans-serif',
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      typography: {
        DEFAULT: {
          css: {
            maxWidth: 'none',
            color: '#1F2937',
            a: { color: '#0EA5E9', textDecoration: 'none' },
            'a:hover': { textDecoration: 'underline' },
            code: {
              backgroundColor: '#F3F4F6',
              padding: '0.15em 0.4em',
              borderRadius: '4px',
              fontSize: '0.875em',
            },
            'pre code': {
              backgroundColor: 'transparent',
              padding: 0,
            },
            blockquote: {
              borderLeftColor: '#0EA5E9',
              color: '#4B5563',
            },
          },
        },
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
        'slide-up': 'slide-up 0.3s ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
