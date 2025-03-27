<script lang="ts">
  import { _ } from 'svelte-i18n';

  import { onNavigate } from '$app/navigation';

  import X from '@src/lib/icons/X.svelte';
  import Menu2 from '@src/lib/icons/Menu2.svelte';

  interface Props {
    profileIsSynced: boolean;
  }

  let { profileIsSynced }: Props = $props();

  let showDropdown = $state(false);

  const toggleDropdown = () => {
    showDropdown = !showDropdown;
  };

  let dropdownToggleAriaLabel = $derived(
    showDropdown ? $_('components.Header.hide-navigation') : $_('components.Header.show-navigation')
  );

  const CONTACT_URL = 'https://organization.university.edu/#contact';

  // close on navigate
  onNavigate(() => {
    showDropdown = false;
  });
</script>

<nav class="navbar">
  <div class="navbar-start pl-2">
    <img src="https://placehold.co/32" alt="The System logo." class="rounded-lg" />
    <a class="text-2xl normal-case pl-2 font-bold" href="/">Sample System</a>
  </div>
  <div class="navbar-end">
    <div class="dropdown">
      <button
        aria-label={dropdownToggleAriaLabel}
        onclick={toggleDropdown}
        class="btn btn-ghost lg:hidden pr-2"
      >
        {#if showDropdown}
          <X />
        {:else}
          <Menu2 />
        {/if}
      </button>
    </div>
  </div>
  <div class="navbar-end hidden lg:flex">
    <ul class="menu menu-horizontal px-1 uppercase font-medium">
      <li>
        <a href="/driver/about">{$_('components.Header.about')}</a>
      </li>
      <li>
        <a href={CONTACT_URL}>{$_('components.Header.contact')}</a>
      </li>
      {#if profileIsSynced}
        <li><a href="/driver/settings">{$_('components.Header.settings')}</a></li>
      {/if}
    </ul>
  </div>
</nav>
<div hidden={!showDropdown} class="bg-primary w-svw">
  <ul class="w-svw flex flex-col text-center py-3 text-lg uppercase font-medium">
    <li class="py-2"><a href="/driver/about">{$_('components.Header.about')}</a></li>
    <li class="py-2"><a href={CONTACT_URL}>{$_('components.Header.contact')}</a></li>
    {#if profileIsSynced}
      <li class="py-2"><a href="/driver/settings">{$_('components.Header.settings')}</a></li>
    {/if}
  </ul>
</div>
<!-- spacer to offset the nav from the content -->
<div class="mb-8"></div>
