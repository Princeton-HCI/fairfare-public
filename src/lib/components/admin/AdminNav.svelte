<script lang="ts">
  import logOut from '@src/lib/client/logOut';
  import { hasCapability } from '@src/lib/rbac';
  import { page } from '$app/state';

  const isLoggedIn = $derived(page.data.session !== null);
  let mobileOpen = $state(false);
  let collapsed = $state(false);

  const basePath = '/admin';
  const currentPath = $derived(page.url.pathname);

  function isActive(href: string): boolean {
    if (href === basePath) return currentPath === basePath;
    return currentPath === href || currentPath.startsWith(`${href}/`);
  }

  // The audit log is admin-only, so researchers never see a link that 403s.
  const canViewAuditLog = $derived(hasCapability(page.data.roles, 'platform:view_audit_log'));

  const navItems = $derived([
    { href: basePath, label: 'Overview', icon: 'home' },
    { href: `${basePath}/organizations`, label: 'Organizations', icon: 'org' },
    { href: `${basePath}/organizers`, label: 'Organizers', icon: 'users' },
    { href: `${basePath}/platform-users`, label: 'Platform users', icon: 'users' },
    { href: `${basePath}/drivers`, label: 'Drivers', icon: 'drivers' },
    // The research aggregates entry is gone: /admin/research 404s for every role,
    // so there is nothing left to link to.
    ...(canViewAuditLog ? [{ href: `${basePath}/audit`, label: 'Audit log', icon: 'audit' }] : [])
  ]);
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
      aria-hidden="true"
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
      aria-hidden="true"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2m-16 0H3m4-12h2m-2 4h2m-2 4h2m4-8h2m-2 4h2m-2 4h2"
      />
    </svg>
  {:else if icon === 'users'}
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class="h-5 w-5 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      stroke-width="1.5"
      aria-hidden="true"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4zm6 0a4 4 0 00-1-7.75"
      />
    </svg>
  {:else if icon === 'drivers'}
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class="h-5 w-5 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      stroke-width="1.5"
      aria-hidden="true"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M3 13l2-5a2 2 0 011.9-1.4h10.2A2 2 0 0119 8l2 5m-18 0v5a1 1 0 001 1h1a1 1 0 001-1v-1h12v1a1 1 0 001 1h1a1 1 0 001-1v-5m-18 0h18M7 16h.01M17 16h.01"
      />
    </svg>
  {:else if icon === 'audit'}
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class="h-5 w-5 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      stroke-width="1.5"
      aria-hidden="true"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
      />
    </svg>
  {/if}
{/snippet}

{#snippet logoutIcon()}
  <svg
    xmlns="http://www.w3.org/2000/svg"
    class="h-5 w-5 shrink-0"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    stroke-width="1.5"
    aria-hidden="true"
  >
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
    />
  </svg>
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
      aria-hidden="true"
    >
      <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  </button>
  <img src="/img/systemlogo.svg" alt="System Logo" class="w-7 h-auto" />
  <span class="text-lg font-bold">System Admin</span>
</div>

<!-- Mobile backdrop -->
{#if mobileOpen}
  <button
    class="lg:hidden fixed inset-0 bg-black/40 z-40"
    onclick={() => (mobileOpen = false)}
    aria-label="Close navigation"
  ></button>
{/if}

<!-- Collapsed: icon-only sidebar, desktop only -->
{#if collapsed}
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
          aria-hidden="true"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
        </svg>
      </button>
    </div>

    <nav class="flex-1 flex flex-col items-center gap-1 py-2 overflow-y-auto w-full px-2">
      {#each navItems as item}
        <a
          href={item.href}
          aria-current={isActive(item.href) ? 'page' : undefined}
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
      {#if isLoggedIn}
        <button
          class="flex items-center justify-center w-10 h-10 rounded-lg text-base-content/50 hover:bg-base-200/50 hover:text-base-content transition-colors cursor-pointer"
          onclick={() => logOut('/admin/login')}
          title="Log out"
          aria-label="Log out"
        >
          {@render logoutIcon()}
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
      <span class="text-xl font-bold text-base-content">Admin</span>
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
        aria-hidden="true"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
      </svg>
    </button>
  </div>

  <nav class="flex-1 px-2 py-2 space-y-1 overflow-y-auto">
    {#each navItems as item}
      <a
        href={item.href}
        aria-current={isActive(item.href) ? 'page' : undefined}
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
    {#if isLoggedIn}
      <button
        class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-base-content/60 hover:bg-base-200/50 hover:text-base-content transition-colors duration-200 cursor-pointer"
        onclick={() => logOut('/admin/login')}
      >
        {@render logoutIcon()}
        <span>Log out</span>
      </button>
    {/if}
  </div>
</aside>
