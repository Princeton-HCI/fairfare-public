/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,js,svelte,ts}', './node_modules/tw-elements/dist/js/**/*.js'],
  theme: {
    fontFamily: {
      sans: ['Noto Sans', 'sans-serif'],
      serif: ['Noto Serif', 'serif']
    },
    extend: {
      typography: (theme) => ({
        DEFAULT: {
          css: {
            h1: {
              fontFamily: theme('fontFamily.serif').join(', '),
              fontWeight: theme('fontWeight.medium')
            },
            h2: {
              fontFamily: theme('fontFamily.serif').join(', '),
              fontWeight: theme('fontWeight.medium')
            },
            h3: {
              fontFamily: theme('fontFamily.serif').join(', '),
              fontWeight: theme('fontWeight.medium')
            },
            h4: {
              fontFamily: theme('fontFamily.serif').join(', '),
              fontWeight: theme('fontWeight.medium')
            }
          }
        }
      })
    }
  },
  daisyui: {
    themes: [
      {
        mytheme: {
          primary: '#8FE36B',
          'primary-content': '#000000',
          secondary: '#77D8A9',
          accent: '#5A527D',
          'accent-content': '#FFFFFF',
          neutral: '#000000',
          'neutral-content': '#FFFFFF',
          'base-100': '#FBFBF3',
          'base-content': '#0E0E0E',
          success: '#8FE36B', // same as primary
          error: '#A13410',
          'error-content': '#FFFFFF'
        }
      }
    ]
  },
  plugins: [require('@tailwindcss/typography'), require('daisyui')]
};
