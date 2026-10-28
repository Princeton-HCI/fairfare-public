<script lang="ts">
  import { onMount } from 'svelte';

  import { title } from '@src/lib/stores/pageinfo';
  import '../app.css';
  import Spinner from '@src/lib/components/Spinner.svelte';

  import { getLocaleFromNavigator, init, isLoading, register } from 'svelte-i18n';

  import { affiliations } from '@src/lib/stores/affiliations';
  import { dataSharingConsents } from '@src/lib/stores/dataSharingConsents';
  import { argyleAccounts } from '@src/lib/stores/argyleAccounts';

  import { page } from '$app/state';
  import { invalidate } from '$app/navigation';

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
  onMount(() => {
    // Set up auth state change listener to refresh page data when session changes
    const {
      data: { subscription }
    } = data.supabase.auth.onAuthStateChange(() => {
      invalidate('supabase:auth');
    });

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

    // Clean up subscription on unmount
    return () => {
      subscription.unsubscribe();
    };
  });

  const STAGING_HOSTS = ['staging--system.netlify.app', 'staging.getsystem.org'];
  const IS_STAGING = STAGING_HOSTS.includes(page.url.host);

  // Social sharing / search metadata. These are static (English) because
  // crawlers don't run JS or pick a locale.
  const SITE_NAME = 'System';
  const SHARE_TITLE = 'System: Make rideshare more fair';
  const SHARE_DESCRIPTION =
    'Your data will help make a better future of work for yourself and other drivers.';
  const SHARE_IMAGE_ALT =
    'A driver holding a phone showing the System website, seated behind a steering wheel';
  const shareImage = $derived(new URL('/img/opengraph-image.webp', page.url.origin).href);
  const canonicalUrl = $derived(new URL(page.url.pathname, page.url.origin).href);
</script>

<svelte:head>
  <link rel="icon" href={'/favicon.ico'} />
  <title>{$title}</title>

  <meta name="description" content={SHARE_DESCRIPTION} />
  <link rel="canonical" href={canonicalUrl} />

  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content={SITE_NAME} />
  <meta property="og:title" content={SHARE_TITLE} />
  <meta property="og:description" content={SHARE_DESCRIPTION} />
  <meta property="og:url" content={canonicalUrl} />
  <meta property="og:image" content={shareImage} />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:width" content="896" />
  <meta property="og:image:height" content="504" />
  <meta property="og:image:alt" content={SHARE_IMAGE_ALT} />
  <meta property="og:locale" content="en_US" />

  <!-- Twitter / X -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={SHARE_TITLE} />
  <meta name="twitter:description" content={SHARE_DESCRIPTION} />
  <meta name="twitter:image" content={shareImage} />
  <meta name="twitter:image:alt" content={SHARE_IMAGE_ALT} />
</svelte:head>

{#if IS_STAGING}
  <div
    class="bg-[#FFEE8C] text-gray-800 text-center p-2 font-bold top-0 left-0 right-0 z-50 w-full"
  >
    Staging Mode: WARNING! Data may be lost!
  </div>
{/if}

<!-- This if statement lets us load the translations before rendering -->
{#if $isLoading}
  <div class="flex justify-center items-center h-screen">
    <div role="status" aria-live="polite" class="sr-only">Loading content, please wait...</div>
    <Spinner />
  </div>
{:else}
  {@render children()}
{/if}
