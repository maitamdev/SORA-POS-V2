/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        blue: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
          950: '#022c22',
        },
        primary: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
          950: '#022c22',
        },
        amber: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
          950: '#451a03',
        },
        sidebar: {
          bg: '#08080a',      // Obsidian Black
          hover: '#131316',   // Deep Charcoal
          active: '#059669',  // Emerald Green
        },
        // Material Design 3 Dark Theme - Sora POS Enterprise (Green Theme)
        sora: {
          bg: '#0b1c18',      // Very dark green-obsidian
          'surface': '#0b1c18',
          'surface-dim': '#0b1c18',
          'surface-container': '#132c25',
          'surface-container-low': '#0e241e',
          'surface-container-high': '#1a3c32',
          'surface-container-highest': '#234f43',
          'surface-container-lowest': '#05120f',
          'surface-bright': '#2b5e50',
          'surface-variant': '#1e443a',
          'on-bg': '#e1f5f0',
          'on-surface': '#e1f5f0',
          'on-surface-variant': '#c2d6d0',
          'primary': '#a7f3d0',
          'primary-container': '#10b981',
          'on-primary': '#022c22',
          'on-primary-container': '#064e3b',
          'outline': '#8fa59f',
          'outline-variant': '#435c55',
          'error': '#ffb4ab',
          'error-container': '#93000a',
          'on-error': '#690005',
          'on-error-container': '#ffdad6',
          'secondary': '#c2d5cf',
          'tertiary': '#c2d4ce',
          'inverse-surface': '#e1f5f0',
          'inverse-primary': '#059669',
        },
      },
      fontFamily: {
        sans: ['Lexend', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        title: ['Lexend', 'Inter', 'sans-serif'],
      },
      fontSize: {
        'headline-xl': ['36px', { lineHeight: '44px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'headline-lg': ['28px', { lineHeight: '36px', letterSpacing: '-0.01em', fontWeight: '600' }],
        'headline-md': ['20px', { lineHeight: '28px', fontWeight: '600' }],
        'body-lg': ['16px', { lineHeight: '24px', fontWeight: '400' }],
        'body-md': ['14px', { lineHeight: '20px', fontWeight: '400' }],
        'label-md': ['12px', { lineHeight: '16px', letterSpacing: '0.05em', fontWeight: '600' }],
      },
      animation: {
        'shake': 'shake 0.5s ease-in-out',
        'float': 'float 3s ease-in-out infinite',
        'fadeIn': 'fadeIn 0.4s ease-out',
        'slideUp': 'slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
        'glow-pulse': 'glowPulse 3s ease-in-out infinite',
        'scan-line': 'scanLine 4s linear infinite',
      },
      keyframes: {
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-5px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(5px)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(30px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 15px rgba(96, 165, 250, 0.15)' },
          '50%': { boxShadow: '0 0 30px rgba(96, 165, 250, 0.3)' },
        },
        scanLine: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
      },
    },
  },
  plugins: [],
};
