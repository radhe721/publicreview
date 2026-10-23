/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{js,jsx}'
  ],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: '1rem',
        sm: '1.5rem',
        lg: '2rem',
      },
      screens: {
        '2xl': '1140px',
      },
    },
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: {
          DEFAULT: 'var(--surface)',
          hover: 'var(--surface-hover)',
          muted: 'var(--surface-muted)',
          raised: 'var(--surface-raised)',
        },
        overlay: 'var(--overlay)',
        ink: {
          DEFAULT: 'var(--ink)',
          muted: 'var(--ink-muted)',
          faint: 'var(--ink-faint)',
        },
        border: {
          DEFAULT: 'var(--border)',
          strong: 'var(--border-strong)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          strong: 'var(--accent-strong)',
          ink: 'var(--accent-ink)',
          soft: 'var(--accent-soft)',
        },
        success: {
          DEFAULT: 'var(--success)',
          soft: 'var(--success-soft)',
        },
        danger: {
          DEFAULT: 'var(--danger)',
          soft: 'var(--danger-soft)',
        },
        'disabled-bg': 'var(--disabled-bg)',
        'disabled-ink': 'var(--disabled-ink)',
        'skeleton-a': 'var(--skeleton-a)',
        'skeleton-b': 'var(--skeleton-b)',
        'focus-ring': 'var(--focus-ring)',

        // Standard shadcn aliases mapped directly to tokens
        background: 'var(--bg)',
        foreground: 'var(--ink)',
        card: {
          DEFAULT: 'var(--surface)',
          foreground: 'var(--ink)',
        },
        popover: {
          DEFAULT: 'var(--surface-raised)',
          foreground: 'var(--ink)',
        },
        primary: {
          DEFAULT: 'var(--accent-strong)',
          foreground: 'var(--accent-ink)',
          hover: 'var(--accent)',
        },
        secondary: {
          DEFAULT: 'var(--surface-muted)',
          foreground: 'var(--ink)',
        },
        muted: {
          DEFAULT: 'var(--surface-muted)',
          foreground: 'var(--ink-muted)',
        },
        destructive: {
          DEFAULT: 'var(--danger)',
          foreground: 'var(--accent-ink)',
        },
        input: 'var(--border-strong)',
        ring: 'var(--focus-ring)',
      },
      borderRadius: {
        none: '0px',
        tile: '10px',
        btn: '8px',
        box: '10px',
        card: '12px',
        dialog: '12px',
        sm: '8px',
        md: '10px',
        lg: '12px',
        xl: '12px',
        full: '9999px',
      },
      boxShadow: {
        none: 'none',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      maxWidth: {
        content: '860px',
      },
      height: {
        nav: '64px',
        control: '44px',
      },
      minHeight: {
        control: '44px',
      },
    },
  },
  plugins: [],
};
