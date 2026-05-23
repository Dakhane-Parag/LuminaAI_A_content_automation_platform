/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // BrandFlow AI Design System
        background: '#050505',
        surface: '#111827',
        'surface-high': '#1F2937',
        'surface-border': 'rgba(255,255,255,0.08)',
        primary: '#3B82F6',
        'primary-hover': '#2563EB',
        secondary: '#6B5CF6',
        tertiary: '#D946EF',
        // Status colors
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
        // Text
        'text-primary': '#F9FAFB',
        'text-secondary': '#9CA3AF',
        'text-muted': '#6B7280',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #3B82F6, #6B5CF6)',
        'gradient-brand': 'linear-gradient(135deg, #3B82F6 0%, #6B5CF6 50%, #D946EF 100%)',
        'gradient-surface': 'linear-gradient(135deg, rgba(59,130,246,0.05) 0%, rgba(107,92,246,0.05) 100%)',
      },
      boxShadow: {
        'glow-primary': '0 0 20px rgba(59, 130, 246, 0.2)',
        'glow-secondary': '0 0 20px rgba(107, 92, 246, 0.2)',
        'card': '0 1px 3px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}
