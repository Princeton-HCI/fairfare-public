import { init, addMessages } from 'svelte-i18n';

import en from '../../src/lang/en.json';
import es from '../../src/lang/es.json';
import fr from '../../src/lang/fr.json';

const setUpI18n = () => {
  addMessages('en', en);
  addMessages('es', es);
  addMessages('fr', fr);

  init({
    fallbackLocale: 'en',
    initialLocale: 'en'
  });
};

export default setUpI18n;
