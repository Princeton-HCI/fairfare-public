<script lang="ts">
  import logOut from '@src/lib/client/logOut';
  import { _ } from 'svelte-i18n';
  import { page } from '$app/state';
  import { hasCapability } from '@src/lib/rbac';
  import ExportNotificationsDropdown from './ExportNotificationsDropdown.svelte';

  interface Props {
    organizationKey: string;
  }

  let { organizationKey }: Props = $props();
  const isLoggedIn = $derived(page.data.session !== null);
  let mobileOpen = $state(false);
  let collapsed = $state(false);

  const basePath = $derived(`/organizer/org/${organizationKey}`);
  const currentPath = $derived(page.url.pathname);

  function isActive(href: string): boolean {
    if (href === basePath) return currentPath === basePath;
    return currentPath.startsWith(href);
  }

  const roles = $derived(page.data.roles);
  // Exports are per-driver data; researchers can view but never download.
  const canExport = $derived(hasCapability(roles, 'org:export_driver_data', organizationKey));
  // Admins and researchers reach org dashboards from the admin area; give them a way back.
  const canViewAdmin = $derived(hasCapability(roles, 'platform:view_admin_dashboard'));
  const navItems = $derived(
    [
      { href: basePath, label: $_('organizer.nav.dashboard'), icon: 'home' },
      { href: `${basePath}/lost-wages`, label: $_('organizer.nav.lost-wages'), icon: 'wages' },
      { href: `${basePath}/sick-time`, label: $_('organizer.nav.sick-time'), icon: 'sick' },
      {
        href: `${basePath}/policy-analysis`,
        label: $_('organizer.nav.policy-analysis'),
        icon: 'policy'
      },
      { href: `${basePath}/definitions`, label: $_('organizer.nav.definitions'), icon: 'book' },
      hasCapability(roles, 'org:manage_argyle_settings', organizationKey)
        ? {
            href: `${basePath}/argyle-settings`,
            label: $_('organizer.nav.settings'),
            icon: 'settings'
          }
        : null,
      hasCapability(roles, 'org:manage_members', organizationKey)
        ? { href: `${basePath}/team`, label: $_('organizer.nav.team'), icon: 'team' }
        : null,
      canViewAdmin
        ? {
            href: '/admin/organizations',
            label: $_('organizer.nav.all-organizations'),
            icon: 'org'
          }
        : null
    ].filter((item): item is { href: string; label: string; icon: string } => item !== null)
  );
</script>

{#snippet navIcon(icon: string)}
  {#if icon === 'home'}
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class="h-5 w-5 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      stroke-width="1.5"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
      />
    </svg>
  {:else if icon === 'org'}
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class="h-5 w-5 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      stroke-width="1.5"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2m-16 0H3m4-12h2m-2 4h2m-2 4h2m4-8h2m-2 4h2m-2 4h2"
      />
    </svg>
  {:else if icon === 'wages'}
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class="h-5 w-5 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      stroke-width="1.5"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  {:else if icon === 'sick'}
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class="h-5 w-5 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      stroke-width="1.5"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  {:else if icon === 'policy'}
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class="h-5 w-5 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      stroke-width="1.5"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
      />
    </svg>
  {:else if icon === 'book'}
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class="h-5 w-5 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      stroke-width="1.5"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
      />
    </svg>
  {:else if icon === 'team'}
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class="h-5 w-5 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      stroke-width="1.5"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4zm6 0a4 4 0 00-1-7.75"
      />
    </svg>
  {:else if icon === 'settings'}
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class="h-5 w-5 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      stroke-width="1.5"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  {/if}
{/snippet}

<!-- Mobile top bar -->
<div
  class="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-base-200 text-base-content h-14 flex items-center px-4 gap-3"
>
  <button
    class="p-1.5 rounded-lg hover:bg-base-200/50 transition-colors duration-200"
    onclick={() => (mobileOpen = !mobileOpen)}
    aria-label="Toggle navigation"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      stroke-width="2"
    >
      <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  </button>
  <img src="/img/systemlogo.svg" alt="System Logo" class="w-7 h-auto" />
  <span class="text-lg font-bold">System</span>
</div>

<!-- Mobile backdrop -->
{#if mobileOpen}
  <button
    class="lg:hidden fixed inset-0 bg-black/40 z-40"
    onclick={() => (mobileOpen = false)}
    aria-label="Close navigation"
  ></button>
{/if}

<!-- Sidebar -->
{#if collapsed}
  <!-- Collapsed: icon-only sidebar, desktop only -->
  <aside
    class="hidden lg:flex fixed lg:static top-0 left-0 z-50 h-screen w-16 bg-white border-r border-base-200 text-base-content flex-col shrink-0 items-center"
  >
    <div class="py-5 flex flex-col items-center gap-1">
      <img src="/img/systemlogo.svg" alt="System Logo" class="w-8 h-auto" />
      <button
        class="mt-1 p-1 rounded-md text-base-content/30 hover:bg-base-200/50 hover:text-base-content/60 transition-colors cursor-pointer"
        onclick={() => (collapsed = false)}
        title="Expand sidebar"
        aria-label="Expand sidebar"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-3.5 w-3.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
        </svg>
      </button>
    </div>

    <nav class="flex-1 flex flex-col items-center gap-1 py-2 overflow-y-auto w-full px-2">
      {#each navItems as item}
        <a
          href={item.href}
          class="flex items-center justify-center w-10 h-10 rounded-lg transition-colors duration-200 cursor-pointer
            {isActive(item.href)
            ? 'bg-primary/15 text-base-content'
            : 'text-base-content/50 hover:bg-base-200/50 hover:text-base-content'}"
          title={item.label}
        >
          {@render navIcon(item.icon)}
        </a>
      {/each}
    </nav>

    <div class="py-4 border-t border-base-200 flex flex-col items-center gap-2 w-full px-2">
      {#if canExport}
        <ExportNotificationsDropdown iconOnly={true} />
      {/if}
      {#if isLoggedIn}
        <button
          class="flex items-center justify-center w-10 h-10 rounded-lg text-base-content/50 hover:bg-base-200/50 hover:text-base-content transition-colors cursor-pointer"
          onclick={() => logOut('/organizer/login')}
          title={$_('components.Header.logout')}
          aria-label={$_('components.Header.logout')}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="1.5"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>
        </button>
      {/if}
    </div>
  </aside>
{/if}

<!-- Expanded sidebar (also used for mobile drawer) -->
<aside
  class="fixed lg:static top-0 left-0 z-50 h-screen w-60 bg-white border-r border-base-200 text-base-content flex flex-col shrink-0 transition-transform duration-300
    {collapsed ? 'lg:hidden' : ''}
    {mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}"
>
  <div class="px-4 py-5 flex items-center justify-between">
    <div class="flex items-center gap-3">
      <img src="/img/systemlogo.svg" alt="System Logo" class="w-8 h-auto shrink-0" />
      <a
        href="/"
        class="text-xl font-bold text-base-content hover:text-base-content/80 transition-colors"
        >System</a
      >
    </div>
    <button
      class="hidden lg:flex items-center justify-center w-7 h-7 rounded-md text-base-content/30 hover:bg-base-200/50 hover:text-base-content/60 transition-colors cursor-pointer"
      onclick={() => (collapsed = true)}
      title="Collapse sidebar"
      aria-label="Collapse sidebar"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-3.5 w-3.5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
      </svg>
    </button>
  </div>

  <nav class="flex-1 px-2 py-2 space-y-1 overflow-y-auto">
    {#each navItems as item}
      <a
        href={item.href}
        class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 cursor-pointer
          {isActive(item.href)
          ? 'bg-primary/15 text-base-content border-l-[3px] border-primary -ml-px'
          : 'text-base-content/60 hover:bg-base-200/50 hover:text-base-content'}"
        onclick={() => (mobileOpen = false)}
      >
        {@render navIcon(item.icon)}
        <span>{item.label}</span>
      </a>
    {/each}
  </nav>

  <div class="px-2 py-4 border-t border-base-200 space-y-2">
    {#if canExport}
      <div class="px-3">
        <ExportNotificationsDropdown />
      </div>
    {/if}
    {#if isLoggedIn}
      <button
        class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-base-content/60 hover:bg-base-200/50 hover:text-base-content transition-colors duration-200 cursor-pointer"
        onclick={() => logOut('/organizer/login')}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-5 w-5 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="1.5"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
          />
        </svg>
        <span>{$_('components.Header.logout')}</span>
      </button>
    {/if}
  </div>
</aside>
