<script lang="ts">
  import { onMount } from 'svelte';

  import { title } from '@src/lib/stores/pageinfo';
  import '../app.css';

  import { getLocaleFromNavigator, init, isLoading, register } from 'svelte-i18n';

  import { affiliations } from '@src/lib/stores/affiliations';
  import { dataSharingConsents } from '@src/lib/stores/dataSharingConsents';
  import { argyleAccounts } from '@src/lib/stores/argyleAccounts';

  let { data, children } = $props();

  // Prepare all of the internationalization information

  // Loads each of the supported languages
  register('en', () => import('../lang/en.json'));
  register('es', () => import('../lang/es.json'));
  register('fr', () => import('../lang/fr.json'));

  const getInitialLocale = () => {
    /* We want to use the simple locales, i.e.,
     * 'en', 'es', 'fr', etc. instead of the
     * full locales, i.e., 'en-US', 'es-ES', 'fr-FR', etc.
     */
    // Use the user's preferred language if available
    if (data.userPreferredLanguage) {
      return data.userPreferredLanguage;
    }
    const localeFromNavigator = getLocaleFromNavigator();
    if (localeFromNavigator === null) return localeFromNavigator;
    if (localeFromNavigator.includes('-')) {
      return localeFromNavigator.split('-')[0];
    }
    return localeFromNavigator;
  };

  // Initialize the internationalization library
  init({
    fallbackLocale: 'en',
    initialLocale: getInitialLocale()
  });

  // This code lets us save the store to the session storage so it persists
  // between page loads.
  let savestore = $state(false);
  $effect(() => {
    if (savestore && $affiliations) {
      window.sessionStorage.setItem('affiliations', JSON.stringify($affiliations));
    }
    if (savestore && $argyleAccounts) {
      window.sessionStorage.setItem('argyleAccounts', JSON.stringify($argyleAccounts));
    }
    if (savestore && $dataSharingConsents) {
      window.sessionStorage.setItem('dataSharingConsents', JSON.stringify($dataSharingConsents));
    }
  });
  onMount(async () => {
    let affiliationsFromSessionStorage = window.sessionStorage.getItem('affiliations');
    if (affiliationsFromSessionStorage) {
      $affiliations = JSON.parse(affiliationsFromSessionStorage);
    }
    let dataSharingConsentsFromSessionStorage =
      window.sessionStorage.getItem('dataSharingConsents');
    if (dataSharingConsentsFromSessionStorage) {
      $dataSharingConsents = JSON.parse(dataSharingConsentsFromSessionStorage);
    }
    let argyleAccountsFromSessionStorage = window.sessionStorage.getItem('argyleAccounts');
    if (argyleAccountsFromSessionStorage) {
      $argyleAccounts = JSON.parse(argyleAccountsFromSessionStorage);
    }
    savestore = true;
  });
</script>

<svelte:head>
  <link rel="icon" href={'/favicon.ico'} />
  <title>{$title}</title>
</svelte:head>

<!-- This if statement lets us load the translations before rendering -->
{#if $isLoading}
  Please wait...
{:else}
  {@render children()}
{/if}
