<script lang="ts">
  import short from 'short-uuid';

  import { locale } from 'svelte-i18n';

  import ConfirmDialog from '@src/lib/components/ConfirmDialog.svelte';
  import { formatPersonName, formatPhoneNumber } from '@src/lib/utils';
  import { type ProfileWithDetails, driverHasSynced } from '@src/routes/organizer/utils';

  interface Props {
    profiles: ProfileWithDetails[];
    desc: string;
    baseURL?: string;
    emptyMessage?: string;
    showDeaffiliateButton?: boolean;
    onDeaffiliate?: (driverUserId: string) => Promise<void> | void;
    deaffiliatingUserId?: string | null;
    deaffiliateLabel?: string;
    deaffiliatingLabel?: string;
    deaffiliateConfirmTitle?: string;
    deaffiliateConfirmMessage?: (driverName: string) => string;
    /** Show the billing/sync status filter next to the sort dropdown. */
    showStatusFilter?: boolean;
  }

  let {
    profiles,
    desc,
    baseURL = '',
    emptyMessage = 'No drivers found',
    showDeaffiliateButton = false,
    onDeaffiliate = async () => {},
    deaffiliatingUserId = null,
    deaffiliateLabel = 'Remove',
    deaffiliatingLabel = 'Removing...',
    deaffiliateConfirmTitle = 'Remove driver?',
    deaffiliateConfirmMessage = (driverName: string) =>
      `Remove ${driverName} from your organization? They will lose access to share data with you.`,
    showStatusFilter = false
  }: Props = $props();

  const isBilledToOrganization = (driver: ProfileWithDetails) => !!driver.is_billed_to_organization;

  type SyncStatus = 'synced' | 'not_connected';

  // Lists without the `has_argyle_sync` flag (e.g. lost-wages, sick-time) may
  // include deleted accounts, so they only get the "synced" check they always
  // had. Lists with the flag only call out drivers who never finished linking:
  // every connected account syncs on its own, so sync progress isn't
  // something an organizer can act on.
  const getSyncStatus = (driver: ProfileWithDetails): SyncStatus | null => {
    if (driver.has_argyle_sync === undefined) return driverHasSynced(driver) ? 'synced' : null;
    return driver.has_argyle_sync ? null : 'not_connected';
  };

  let billedOnly = $state(false);

  const handleDeaffiliate = async (driverUserId: string) => {
    await onDeaffiliate(driverUserId);
  };

  if (!profiles) {
    throw new Error('No profiles found');
  }

  const translator = short();

  let searchQuery = $state('');

  let statusFilteredProfiles = $derived(
    profiles.filter((profile) => !billedOnly || isBilledToOrganization(profile))
  );

  let filteredProfiles = $derived(
    searchQuery
      ? statusFilteredProfiles.filter((profile: ProfileWithDetails) => {
          const name = `${profile.first_name} ${profile.last_initial}`;
          const phone = profile.phone;
          const formattedPhone = phone ? formatPhoneNumber(phone) : '';
          const email = profile.email;
          const searchLower = searchQuery.toLowerCase();

          const phoneDigitsOnly = phone ? phone.replace(/\D/g, '') : '';
          const searchDigitsOnly = searchQuery.replace(/\D/g, '');

          return (
            name.toLowerCase().includes(searchLower) ||
            phone?.includes(searchQuery) ||
            formattedPhone.includes(searchQuery) ||
            (searchDigitsOnly.length > 0 && phoneDigitsOnly.includes(searchDigitsOnly)) ||
            email?.toLowerCase().includes(searchLower)
          );
        })
      : statusFilteredProfiles
  );

  // Newest consent first.
  let filteredAndSortedProfiles = $derived.by(() => {
    return [...filteredProfiles].sort((a: ProfileWithDetails, b: ProfileWithDetails) => {
      const aDate = new Date(
        a.driver_affiliate_organization_data_sharing_consents[0]?.created_at || 0
      );
      const bDate = new Date(
        b.driver_affiliate_organization_data_sharing_consents[0]?.created_at || 0
      );
      return bDate.getTime() - aDate.getTime();
    });
  });

  let currentPage = $state(1);

  // Read both up front: a short-circuited `||` would stop tracking the filter
  // while a search is active, leaving the user on a stale page.
  $effect(() => {
    const narrowed = searchQuery !== '';
    const filtered = billedOnly;
    if (narrowed || filtered) {
      currentPage = 1;
    }
  });

  const pageSize = 20;

  let paginatedProfiles = $derived.by(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedProfiles.slice(start, start + pageSize);
  });

  let totalProfiles = $derived(filteredAndSortedProfiles.length);
  let previousButtonIsDisabled = $derived(currentPage === 1);
  let nextButtonIsDisabled = $derived(currentPage >= Math.ceil(totalProfiles / pageSize));
  let currentPageStart = $derived((currentPage - 1) * pageSize + 1);
  let currentPageEnd = $derived(Math.min(currentPage * pageSize, totalProfiles));

  // Keep the page in range when rows disappear (e.g. after "Disable sync"
  // removes the last driver on the final page and the list reloads).
  $effect(() => {
    const lastPage = Math.max(1, Math.ceil(totalProfiles / pageSize));
    if (currentPage > lastPage) currentPage = lastPage;
  });
</script>

{#snippet consentDate(driver: ProfileWithDetails)}
  {#if driver.driver_affiliate_organization_data_sharing_consents[0]?.created_at}
    {new Date(
      driver.driver_affiliate_organization_data_sharing_consents[0].created_at
    ).toLocaleDateString($locale?.toString() || 'en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })}
  {:else}
    —
  {/if}
{/snippet}

<div class="w-full bg-white rounded-lg shadow-sm overflow-hidden">
  <div class="px-5 pt-5 pb-4">
    <h2 class="text-lg font-semibold text-base-content mb-4">{desc}</h2>

    <div class="flex flex-wrap gap-3 items-center">
      {#if showStatusFilter}
        <label
          class="flex items-center gap-2 h-9 shrink-0 text-sm text-base-content cursor-pointer"
        >
          <input type="checkbox" class="checkbox checkbox-sm" bind:checked={billedOnly} />
          Billed to this org
        </label>
      {/if}
      <div class="flex-1 min-w-48 relative">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 16 16"
          fill="currentColor"
          class="w-4 h-4 text-base-content/30 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
        >
          <path
            fill-rule="evenodd"
            d="M9.965 11.026a5 5 0 1 1 1.06-1.06l2.755 2.754a.75.75 0 1 1-1.06 1.06l-2.755-2.754ZM10.5 7a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z"
            clip-rule="evenodd"
          />
        </svg>
        <input
          type="text"
          name="search"
          class="w-full h-9 text-sm bg-white border border-base-300 rounded-lg pl-9 pr-3 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          placeholder="Search by name, phone, or email..."
          bind:value={searchQuery}
        />
      </div>
    </div>
  </div>

  <!-- Table header — last column either chevron (2rem) or auto for Remove button -->
  <div
    class="hidden sm:grid gap-4 px-5 py-2 bg-base-200/30 text-xs font-semibold uppercase tracking-wide text-base-content/40 border-y border-base-200 {showDeaffiliateButton
      ? 'grid-cols-[1fr_auto_auto_auto_auto]'
      : 'grid-cols-[1fr_auto_auto_auto_2rem]'}"
  >
    <span>Name</span>
    <span class="w-28">Phone</span>
    <span class="w-44">Email</span>
    <span class="w-28 text-right">Shared on</span>
    <span></span>
  </div>

  <ul data-testid="drivers-list" class="divide-y divide-base-200">
    {#each paginatedProfiles as driver}
      {@const syncStatus = getSyncStatus(driver)}
      <li>
        <!--
          One row template, rendered as either an <a> (read-only navigation
          mode) or a <div> (deaffiliate mode). svelte:element lets us avoid
          duplicating ~70 lines of cell markup just to swap the wrapper.
        -->
        <svelte:element
          this={showDeaffiliateButton ? 'div' : 'a'}
          href={showDeaffiliateButton
            ? undefined
            : `${baseURL}/${translator.fromUUID(driver.user_id)}`}
          class={showDeaffiliateButton
            ? 'sm:grid sm:grid-cols-[1fr_auto_auto_auto_auto] gap-4 items-center px-5 py-3 flex flex-col sm:flex-row sm:justify-normal'
            : 'sm:grid grid-cols-[1fr_auto_auto_auto_2rem] gap-4 items-center px-5 py-3 hover:bg-base-200/20 transition-colors duration-150 cursor-pointer group flex justify-between'}
        >
          <div class="flex items-center gap-2 min-w-0 w-full">
            <span class="text-sm font-medium text-base-content truncate"
              >{formatPersonName(driver)}</span
            >
            {#if isBilledToOrganization(driver)}
              <span
                class="badge badge-sm badge-outline"
                title="Argyle usage for this driver is billed to this organization">Billed</span
              >
            {/if}
            {#if syncStatus === 'not_connected'}
              <span
                class="badge badge-sm badge-ghost text-base-content/50"
                title="Driver hasn't finished linking their Uber/Lyft account">Not connected</span
              >
            {/if}
            {#if syncStatus === 'synced'}
              <span class="inline-flex items-center gap-1 shrink-0">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.75"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="text-green-600"
                  role="img"
                >
                  <title>Data Synced</title>
                  <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                  <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
                  <path d="M9 12l2 2l4 -4" />
                </svg>
                <span class="text-[10px] font-bold uppercase text-green-600 hidden lg:inline"
                  >Synced</span
                >
              </span>
            {/if}
          </div>
          <span class="w-28 text-sm text-base-content/60 hidden sm:block"
            >{driver.phone ? formatPhoneNumber(driver.phone) : '—'}</span
          >
          <span class="w-44 text-sm text-base-content/50 truncate hidden sm:block"
            >{driver.email || '—'}</span
          >
          <span class="w-28 text-sm text-base-content/40 text-right hidden sm:block">
            {@render consentDate(driver)}
          </span>

          {#if showDeaffiliateButton}
            <div class="flex w-full justify-end sm:w-auto">
              <ConfirmDialog
                id={`deaffiliate-${driver.user_id}`}
                title={deaffiliateConfirmTitle}
                message={deaffiliateConfirmMessage(formatPersonName(driver, 'this driver'))}
                confirmLabel={deaffiliateLabel}
                destructive
                onConfirm={() => handleDeaffiliate(driver.user_id)}
                buttonClass="btn btn-xs btn-ghost text-error/70 hover:text-error hover:bg-error/10 transition-colors duration-150"
                buttonDisabled={deaffiliatingUserId === driver.user_id}
              >
                {#snippet trigger()}
                  {deaffiliatingUserId === driver.user_id ? deaffiliatingLabel : deaffiliateLabel}
                {/snippet}
              </ConfirmDialog>
            </div>
          {:else}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4 text-base-content/15 shrink-0 group-hover:text-base-content/40 transition-colors"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M9 6l6 6-6 6" />
            </svg>
          {/if}

          <div class="sm:hidden text-xs text-base-content/40 mt-1 col-span-full w-full">
            {#if driver.phone}{formatPhoneNumber(driver.phone)} &middot;
            {/if}{driver.email || ''}
          </div>
        </svelte:element>
      </li>
    {/each}

    {#if filteredAndSortedProfiles.length === 0 && searchQuery}
      <li class="text-center py-10 text-base-content/40 text-sm">
        No drivers found matching "{searchQuery}"
      </li>
    {:else if filteredAndSortedProfiles.length === 0 && billedOnly}
      <li class="text-center py-10 text-base-content/40 text-sm">No drivers match this filter</li>
    {:else if filteredAndSortedProfiles.length === 0}
      <li class="text-center py-10 text-base-content/40 text-sm">{emptyMessage}</li>
    {/if}
  </ul>

  {#if totalProfiles > pageSize}
    <div
      class="flex items-center justify-between px-5 py-3 border-t border-base-200 bg-base-200/10"
    >
      <button
        onclick={() => (currentPage = currentPage - 1)}
        class="btn btn-sm btn-ghost"
        disabled={previousButtonIsDisabled}
      >
        Previous
      </button>
      <span class="text-xs text-base-content/50">
        {currentPageStart}&ndash;{currentPageEnd} of {totalProfiles}
      </span>
      <button
        onclick={() => (currentPage = currentPage + 1)}
        class="btn btn-sm btn-ghost"
        disabled={nextButtonIsDisabled}
      >
        Next
      </button>
    </div>
  {:else}
    <div
      class="px-5 py-3 border-t border-base-200 bg-base-200/10 text-center text-xs text-base-content/40"
    >
      {totalProfiles} drivers
    </div>
  {/if}
</div>
