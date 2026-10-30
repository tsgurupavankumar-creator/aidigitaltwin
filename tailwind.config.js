/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        fraunces: ['Fraunces', 'serif'],
        instrument: ['Instrument Serif', 'serif'],
        baskerville: ['Libre Baskerville', 'serif'],
        inter: ['Inter', 'sans-serif'],
        dmsans: ['DM Sans', 'sans-serif'],
        space: ['Space Grotesk', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        paper: {
          0: '#FDFCFA',
          1: '#F7F5F2',
          2: '#EFEBE5',
          3: '#E5DFD6',
        },
        ink: {
          0: '#1A1814',
          1: '#3D3833',
          2: '#6B6560',
          3: '#9C958E',
        },
        terracotta: {
          DEFAULT: '#C65D3B',
          hover: '#B24F2F',
          light: '#FDF5F2',
        },
        olive: {
          DEFAULT: '#5A6B47',
          light: '#F4F7F2',
        },
        mustard: {
          DEFAULT: '#D4A24C',
          light: '#FDF8F0',
        },
        burgundy: {
          DEFAULT: '#8B3A3A',
          light: '#FDF2F2',
        },
        navy: {
          DEFAULT: '#2C3E50',
          light: '#F2F6F9',
        },
        plum: {
          DEFAULT: '#6B4A5D',
          light: '#F8F3F6',
        },
      },
      borderRadius: {
        DEFAULT: '8px',
        sm: '6px',
        md: '8px',
        lg: '12px',
        full: '9999px',
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
