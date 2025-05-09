import adapter from '@sveltejs/adapter-netlify';
import preprocess from 'svelte-preprocess';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  // Consult https://github.com/sveltejs/svelte-preprocess
  // for more information about preprocessors
  preprocess: preprocess({
    postcss: true
  }),

  kit: {
    adapter: adapter({
      // if true, will create a Netlify Edge Function rather
      // than using standard Node-based functions
      edge: false,

      // if true, will split your app into multiple functions
      // instead of creating a single one for the entire app.
      // if `edge` is true, this option cannot be used
      split: false
    }),
    alias: {
      '@src': './src',
      '@tests': './tests',
      '@lib': './src/lib',
      '@utils': './src/utils',
      '@components': './src/lib/components',
      '@routes': './src/routes'
    },
    env: {
      publicPrefix: 'PUB_'
    }
  }
};

export default config;
