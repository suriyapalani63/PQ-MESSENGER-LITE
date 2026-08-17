/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'bg-base': '#05070D',
        'bg-sidebar': '#080D18',
        'bg-card': '#0D1626',
        'primary': '#008CFF',
        'neon-blue': '#00B7FF',
        'cyan-hl': '#22D3EE',
        'text-main': '#F8FAFC',
        'text-sec': '#94A3B8',
        'border-neon': 'rgba(0, 163, 255, 0.22)',
        'success': '#22C55E',
        'warning': '#F59E0B',
        'error': '#EF4444',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      backgroundImage: {
        'grid-pattern': "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h40v40H0V0zm1 1h38v38H1V1z' fill='%2300b7ff' fill-opacity='0.02' fill-rule='evenodd'/%3E%3C/svg%3E\")",
      }
    },
  },
  plugins: [],
}
