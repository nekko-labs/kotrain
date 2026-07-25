/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./src/renderer/**/*.{html,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: 'var(--ink)',
        'ink-soft': 'var(--ink-soft)',
        'ink-faint': 'var(--ink-faint)',
        paper: 'var(--paper)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        line: 'var(--line)',
        accent: 'var(--accent)',
        'accent-soft': 'var(--accent-soft)',
        success: 'var(--success)',
        'success-soft': 'var(--success-soft)',
        danger: 'var(--danger)',
        'danger-soft': 'var(--danger-soft)',
        warning: 'var(--warning)',
        'warning-soft': 'var(--warning-soft)',
        info: 'var(--info)',
        'info-soft': 'var(--info-soft)',
        neutral: 'var(--neutral)',
        'neutral-soft': 'var(--neutral-soft)',
        running: 'var(--running)',
        highlight: 'var(--highlight)',
      },
      borderRadius: { xl: '12px', '2xl': '16px' },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
