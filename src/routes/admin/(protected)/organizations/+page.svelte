<script lang="ts">
  import { invalidateAll, goto } from '$app/navigation';
  import { page as pageState } from '$app/state';
  import { title } from '@src/lib/stores/pageinfo';
  import { toast } from '@src/lib/toasts';
  import { adminApiRequest } from '@src/lib/client/adminApi';
  import { hasCapability } from '@src/lib/rbac';
  import Modal from '@src/lib/components/Modal.svelte';
  import Input from '@src/lib/components/Input.svelte';
  import SearchBar from '@src/lib/components/admin/SearchBar.svelte';
  import Pagination from '@src/lib/components/admin/Pagination.svelte';
  import StatusBadge from '@src/lib/components/admin/StatusBadge.svelte';
  import type { PageData } from './$types';
  import { formatDate, hrefWithParams } from '@src/lib/utils';

  let { data }: { data: PageData } = $props();
  title.set('Organizations');

  const canManage = $derived(hasCapability(pageState.data.roles, 'platform:manage_orgs'));

  let createModal: { closeModal: () => void } | undefined = $state();
  let isCreating = $state(false);

  const statusTabs = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'deleted', label: 'Deleted' }
  ];

  const statusHref = (statusKey: string): string =>
    hrefWithParams(pageState.url, {
      status: statusKey === 'all' ? null : statusKey,
      page: null
    });

  async function createOrganization(event: Event) {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const fd = new FormData(form);
    isCreating = true;
    const ok = await adminApiRequest('/api/admin/organizations', 'POST', {
      name: fd.get('name'),
      key: fd.get('key'),
      url: fd.get('url')
    });
    isCreating = false;
    if (ok) {
      toast({ text: 'Organization created', type: 'success' });
      createModal?.closeModal();
      form.reset();
      await invalidateAll();
    }
  }
</script>

<div class="max-w-6xl">
  <div class="flex flex-wrap items-center justify-between gap-3 mb-1">
    <h1 class="font-serif text-3xl font-bold text-base-content">Organizations</h1>
    {#if canManage}
      <Modal
        id="create-org-modal"
        title="New organization"
        buttonClass="btn btn-neutral btn-sm"
        bind:this={createModal}
      >
        {#snippet buttonContent()}New organization{/snippet}
        {#snippet dialogContent()}
          <form onsubmit={createOrganization} class="mt-2 text-left">
            <Input label="Name" name="name" required />
            <Input
              label="Key"
              name="key"
              required
              bottomLabel="Stable identifier used in URLs and webhooks. Cannot be changed later."
            />
            <Input label="URL" name="url" type="url" />
            <button type="submit" class="btn btn-primary mt-4 w-full" disabled={isCreating}>
              {isCreating ? 'Creating…' : 'Create organization'}
            </button>
          </form>
        {/snippet}
      </Modal>
    {/if}
  </div>
  <p class="text-base-content/60 mb-5">
    {canManage
      ? 'Create, edit, and moderate every organization.'
      : 'Browse every organization and open its dashboard.'}
  </p>

  <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
    <div role="tablist" class="tabs tabs-boxed bg-base-200/50">
      {#each statusTabs as tab}
        <a
          role="tab"
          href={statusHref(tab.key)}
          class="tab {data.statusFilter === tab.key ? 'tab-active' : ''}"
          aria-selected={data.statusFilter === tab.key}>{tab.label}</a
        >
      {/each}
    </div>
    <SearchBar
      value={data.params.q}
      placeholder="Search name or key…"
      preserve={data.statusFilter !== 'all' ? { status: data.statusFilter } : {}}
    />
  </div>

  <div class="overflow-x-auto rounded-lg border border-base-200 bg-white">
    <table class="table table-sm">
      <thead>
        <tr>
          <th>Name</th>
          <th>Key</th>
          <th>Status</th>
          <th>Signup code</th>
          <th>Created</th>
          <th class="text-right">Actions</th>
        </tr>
      </thead>
      <tbody>
        {#each data.organizations as org (org.id)}
          <tr class="hover">
            <td class="font-medium">{org.name}</td>
            <td><code class="text-xs">{org.key}</code></td>
            <td><StatusBadge status={org.status} /></td>
            <td class="tabular-nums">
              {canManage ? (org.signupCode ?? '—') : org.hasSignupCode ? 'Set' : '—'}
            </td>
            <td class="tabular-nums">{formatDate(org.created_at)}</td>
            <td class="text-right whitespace-nowrap">
              <a class="btn btn-xs btn-ghost" href="/organizer/org/{org.key}">Open dashboard</a>
              <a class="btn btn-xs btn-ghost" href="/admin/organizations/{org.key}"
                >{canManage ? 'Manage' : 'Details'}</a
              >
            </td>
          </tr>
        {:else}
          <tr>
            <td colspan="6" class="text-center text-base-content/50 py-10">
              No organizations match your filters.
              <button class="link" onclick={() => goto('/admin/organizations')}
                >Clear filters</button
              >
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <Pagination page={data.params.page} pageSize={data.params.pageSize} total={data.total} />
</div>
