<script lang="ts">
  import { _ } from 'svelte-i18n';

  import { onNavigate } from '$app/navigation';

  import X from '@src/lib/icons/X.svelte';
  import Menu2 from '@src/lib/icons/Menu2.svelte';

  import logOut from '@src/lib/client/logOut';

  import { page } from '$app/state';

  let showDropdown = $state(false);

  // Check if the user is logged in using the session data
  const isLoggedIn = $derived(page.data.session !== null);

  const toggleDropdown = () => {
    showDropdown = !showDropdown;
  };

  let dropdownToggleAriaLabel = $derived(
    showDropdown ? $_('components.Header.hide-navigation') : $_('components.Header.show-navigation')
  );

  const CONTACT_URL = '/#contact-form';

  onNavigate(() => {
    showDropdown = false;
  });
</script>

<nav class="navbar md:px-12 md:py-6 flex-shrink h-16 items-center">
  <div class="navbar-start">
    <img src="/img/systemlogo.svg" alt="System Logo" class="w-8 md:w-12 ml-4 h-auto" />
  </div>

  <div class="navbar-center flex">
    <a href="/" class="flex items-center">
      <p class="text-3xl md:text-4xl font-bold">System</p>
    </a>
  </div>

  <div class="navbar-end">
    <div class="navbar-end hidden xl:flex">
      <a href="/driver/about" class="btn btn-ghost px-2">
        <p class="md:text-base">{$_('components.Header.about')}</p>
      </a>
      <a href={CONTACT_URL} class="btn btn-ghost px-2">
        <p class="md:text-base">{$_('components.Header.contact')}</p>
      </a>
      {#if isLoggedIn}
        <a href="/driver/settings" class="btn btn-ghost px-2">
          <p class="flex items-center md:text-base">
            {$_('components.Header.settings')}
          </p>
        </a>
        <button class="btn btn-ghost px-2" onclick={() => logOut()}>
          <p class="md:text-base">{$_('components.Header.logout')}</p>
        </button>
      {:else}
        <a href="/driver/login" class="btn btn-ghost px-2">
          <p class="md:text-base">{$_('components.Header.login')}</p>
        </a>
      {/if}
    </div>

    <div class="dropdown">
      <button
        aria-label={dropdownToggleAriaLabel}
        onclick={toggleDropdown}
        class="btn btn-ghost xl:hidden"
      >
        {#if showDropdown}
          <X />
        {:else}
          <Menu2 />
        {/if}
      </button>
    </div>
  </div>
</nav>
<div hidden={!showDropdown} class="bg-primary w-svw">
  <ul class="w-svw flex flex-col text-center py-3 text-lg uppercase font-medium">
    <li class="py-2"><a href="/driver/about">{$_('components.Header.about')}</a></li>
    <li class="py-2"><a href={CONTACT_URL}>{$_('components.Header.contact')}</a></li>
    {#if isLoggedIn}
      <li class="py-2"><a href="/driver/settings">{$_('components.Header.settings')}</a></li>
      <li class="py-2">
        <button class="uppercase" onclick={() => logOut()}>{$_('components.Header.logout')}</button>
      </li>
    {:else}
      <li class="py-2"><a href="/driver/login">{$_('components.Header.login')}</a></li>
    {/if}
  </ul>
</div>

<div class="mb-8"></div>
