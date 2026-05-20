/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: '#0F1A2E',
        'ink-soft': '#1F2B42',
        'ink-muted': '#4A5468',
        paper: '#FAF7F1',
        'paper-soft': '#F3EFE6',
        'paper-line': '#E7E1D3',
        amber: '#C5743A',
        'amber-deep': '#A05A26',
        'amber-soft': '#F1DEC4',
        moss: '#4F6A4A',
        white: '#FFFFFF',
      },
      fontFamily: {
        sans: ['Manrope', 'system-ui', 'sans-serif'],
        serif: ['Fraunces', 'Georgia', 'serif'],
        mono: ['Manrope', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'display-xl': ['clamp(3rem, 7vw, 6.5rem)', { lineHeight: '1.05', letterSpacing: '-0.035em' }],
        'display-l': ['clamp(2.5rem, 5.5vw, 4.5rem)', { lineHeight: '1.05', letterSpacing: '-0.028em' }],
        'display-m': ['clamp(2rem, 4vw, 3.25rem)', { lineHeight: '1.08', letterSpacing: '-0.022em' }],
        'display-s': ['clamp(1.625rem, 3vw, 2.25rem)', { lineHeight: '1.1', letterSpacing: '-0.018em' }],
      },
    },
  },
  plugins: [],
};
