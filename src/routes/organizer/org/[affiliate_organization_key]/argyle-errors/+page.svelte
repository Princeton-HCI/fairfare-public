<script lang="ts">
  import { SvelteSet } from 'svelte/reactivity';
  import { getArgyleConnectionError } from '@src/lib/organizer/argyleConnectionErrors';
  import { title } from '@src/lib/stores/pageinfo';
  import { formatDate, formatPersonName, formatPhoneNumber } from '@src/lib/utils';

  let { data } = $props();

  title.set('Organizer | Account Errors');

  const organization = $derived(data.organization);
  const accounts = $derived(data.accounts);
  const glossaryHref = $derived(`/organizer/org/${organization.key}/argyle-errors/glossary`);

  let searchQuery = $state('');

  // Rows whose error explanation is open.
  const expandedIds = new SvelteSet<string>();

  function toggleExpanded(id: string) {
    if (expandedIds.has(id)) expandedIds.delete(id);
    else expandedIds.add(id);
  }

  const filteredAccounts = $derived.by(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return accounts;
    return accounts.filter((account) =>
      [
        formatPersonName(account, ''),
        account.email,
        account.phone,
        account.employer,
        account.error_code,
        getArgyleConnectionError(account.error_code)?.title
      ].some((value) => value?.toLowerCase().includes(query))
    );
  });
</script>

<div>
  <h1 class="font-serif text-2xl font-medium text-base-content">Account errors</h1>
  <p class="text-sm text-base-content/50 mt-1 mb-6">
    Drivers with {organization.name} whose Argyle connection to a gig platform has an error. Reach out
    to help them reconnect. Click an error to see what it means, or read the
    <a href={glossaryHref} target="_blank" rel="noopener noreferrer" class="link">error glossary</a
    >.
  </p>

  <div class="w-full bg-white rounded-lg shadow-sm overflow-hidden">
    <div class="px-5 pt-5 pb-4 flex flex-wrap gap-3 items-center justify-between">
      <h2 class="text-lg font-semibold text-base-content">
        {accounts.length}
        {accounts.length === 1 ? 'account' : 'accounts'} with errors
      </h2>
      {#if accounts.length > 0}
        <input
          type="search"
          class="w-full sm:w-64 h-9 text-sm bg-white border border-base-300 rounded-lg px-3 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          placeholder="Search name, email, phone, error"
          aria-label="Search accounts with errors"
          bind:value={searchQuery}
        />
      {/if}
    </div>

    {#if accounts.length === 0}
      <p class="text-center py-10 text-base-content/40 text-sm border-t border-base-200">
        No accounts with errors for {organization.name}.
      </p>
    {:else if filteredAccounts.length === 0}
      <p class="text-center py-10 text-base-content/40 text-sm border-t border-base-200">
        No accounts match "{searchQuery}"
      </p>
    {:else}
      <div class="overflow-x-auto border-t border-base-200">
        <table class="table table-sm">
          <thead>
            <tr class="text-base-content/50">
              <th>Driver</th>
              <th>Contact</th>
              <th>Platform</th>
              <th>Error</th>
              <th class="text-right">Last updated</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredAccounts as account (account.id)}
              {@const expanded = expandedIds.has(account.id)}
              {@const errorInfo = getArgyleConnectionError(account.error_code)}
              <tr class="hover:bg-base-200/30 {expanded ? 'bg-base-200/30' : ''}">
                <td class="font-medium whitespace-nowrap">{formatPersonName(account)}</td>
                <td>
                  <div class="text-base-content/70">{account.email || '—'}</div>
                  <div class="text-base-content/50 whitespace-nowrap">
                    {account.phone ? formatPhoneNumber(account.phone) : '—'}
                  </div>
                </td>
                <td class="capitalize">{account.employer || '—'}</td>
                <td>
                  {#if account.error_code}
                    <button
                      type="button"
                      class="inline-flex items-center gap-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-error/40"
                      aria-expanded={expanded}
                      aria-controls="error-details-{account.id}"
                      onclick={() => toggleExpanded(account.id)}
                    >
                      <span class="badge badge-sm badge-error badge-outline whitespace-nowrap"
                        >{account.error_code}</span
                      >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-3.5 w-3.5 text-base-content/50 transition-transform {expanded
                          ? 'rotate-180'
                          : ''}"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          fill-rule="evenodd"
                          d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                          clip-rule="evenodd"
                        />
                      </svg>
                      <span class="sr-only">{expanded ? 'Hide' : 'Show'} what this error means</span
                      >
                    </button>
                  {:else}
                    <span class="text-base-content/40">—</span>
                  {/if}
                  {#if account.status && account.status !== 'error'}
                    <div class="text-xs text-base-content/50 mt-1">{account.status}</div>
                  {/if}
                </td>
                <td class="text-right text-base-content/50 whitespace-nowrap">
                  {formatDate(account.argyle_updated_at)}
                </td>
              </tr>
              {#if expanded && account.error_code}
                <tr id="error-details-{account.id}" class="bg-base-200/30">
                  <td colspan="5" class="pt-0 pb-4">
                    <div class="rounded-lg border border-base-200 bg-white px-4 py-3 text-sm">
                      {#if errorInfo}
                        <p class="font-semibold text-base-content">{errorInfo.title}</p>
                        <p class="mt-1 text-base-content/70">{errorInfo.summary}</p>
                      {:else}
                        <p class="text-base-content/70">
                          We don't have an explanation for this error yet.
                        </p>
                      {/if}
                      <a
                        href={errorInfo ? `${glossaryHref}#${account.error_code}` : glossaryHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="link link-primary mt-2 inline-block text-xs font-medium"
                        >Click to see more</a
                      >
                    </div>
                  </td>
                </tr>
              {/if}
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</div>
