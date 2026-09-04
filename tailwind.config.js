/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Warm, near-white and near-black endpoints so body text and inverted
        // CTAs never sit on absolute #FFFFFF/#000000 (minimalist-ui-extension skill).
        white: '#F5F2EA',
        black: '#15130F',
        // Muted green — the product's "positive/active/success" signal. Anchored
        // on the skill's pale-green pair (#EDF3EC bg / #346538 text).
        brand: {
          50: '#EDF3EC',
          100: '#D9E8D6',
          200: '#B7D3B1',
          300: '#8FB989',
          400: '#689D62',
          500: '#4C8146',
          600: '#346538',
          700: '#2A5030',
          800: '#213F26',
          900: '#1A311E',
        },
        // Warm neutral ramp replacing the old cool slate — canvas/card/border/text
        // all come from this single scale (950 darkest, 50 lightest).
        surface: {
          50: '#FAF8F4',
          100: '#F2EEE4',
          200: '#E4DECE',
          300: '#CFC6AE',
          400: '#A79C81',
          500: '#837964',
          600: '#665D4C',
          700: '#4C4438',
          800: '#362F27',
          900: '#211C17',
          950: '#17130F',
        },
        // Overriding Tailwind's saturated defaults with the skill's muted
        // pastels so every existing rose-/amber-/emerald- class across the
        // panel inherits the warm palette without touching each call site.
        rose: {
          50: '#FDEBEC',
          100: '#FAD4D5',
          200: '#F3AEAF',
          300: '#E8807F',
          400: '#D65654',
          500: '#BC3C39',
          600: '#9F2F2D',
          700: '#7E2624',
          800: '#611E1D',
          900: '#4A1716',
        },
        amber: {
          50: '#FBF3DB',
          100: '#F5E6B0',
          200: '#EDD583',
          300: '#E2C158',
          400: '#D4A93A',
          500: '#B98A22',
          600: '#956400',
          700: '#7A5200',
          800: '#5E3F00',
          900: '#493100',
        },
        emerald: {
          50: '#EDF3EC',
          100: '#D9E8D6',
          200: '#B7D3B1',
          300: '#8FB989',
          400: '#689D62',
          500: '#4C8146',
          600: '#346538',
          700: '#2A5030',
          800: '#213F26',
          900: '#1A311E',
        },
      },
      fontFamily: {
        // System-native first — no remote font loads (MV3 CSP), no Inter/Roboto/Open Sans.
        // Leads with the universal `system-ui`/`ui-sans-serif` keywords so every
        // platform (not just macOS) gets a real system font, not a browser default.
        sans: [
          'system-ui',
          'ui-sans-serif',
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Display"',
          '"Segoe UI"',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
          '"Apple Color Emoji"',
          '"Segoe UI Emoji"',
          '"Segoe UI Symbol"',
          '"Noto Color Emoji"',
        ],
        // Editorial accent — used sparingly for a single "hero number" per screen
        // (e.g. the Best Fit score), never for body copy or UI chrome.
        serif: [
          'ui-serif',
          'Georgia',
          '"Times New Roman"',
          'serif',
        ],
        mono: [
          'JetBrains Mono',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          '"Liberation Mono"',
          '"Courier New"',
          'monospace',
        ],
      },
    },
  },
  plugins: [],
}
