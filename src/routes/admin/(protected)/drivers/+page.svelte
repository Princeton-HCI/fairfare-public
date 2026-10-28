<script lang="ts">
  import { page } from '$app/state';
  import { title } from '@src/lib/stores/pageinfo';
  import { hasCapability } from '@src/lib/rbac';
  import { formatPersonName, formatPhoneNumber } from '@src/lib/utils';
  import { driverHasSynced } from '@src/routes/organizer/utils';
  import SearchBar from '@src/lib/components/admin/SearchBar.svelte';
  import Pagination from '@src/lib/components/admin/Pagination.svelte';
  import StatusBadge from '@src/lib/components/admin/StatusBadge.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  title.set('Drivers');

  const canManage = $derived(hasCapability(page.data.roles, 'platform:manage_drivers'));
</script>

<div class="max-w-6xl">
  <h1 class="font-serif text-3xl font-bold text-base-content mb-1">Drivers</h1>
  <p class="text-base-content/60 mb-5">
    {canManage
      ? 'Search and moderate drivers across all organizations.'
      : 'Search drivers across all organizations.'}
  </p>

  <div class="flex justify-end mb-3">
    <SearchBar value={data.params.q} placeholder="Search name, email, phone…" />
  </div>

  <div class="overflow-x-auto rounded-lg border border-base-200 bg-white">
    <table class="table table-sm">
      <thead>
        <tr>
          <th>Name</th>
          <th>Phone</th>
          <th>Email</th>
          <th>Synced</th>
          <th>Orgs shared</th>
          <th class="text-right">Actions</th>
        </tr>
      </thead>
      <tbody>
        {#each data.drivers as { profile, shortId } (profile.user_id)}
          <tr class="hover">
            <td class="font-medium">{formatPersonName(profile)}</td>
            <td class="tabular-nums">{profile.phone ? formatPhoneNumber(profile.phone) : '—'}</td>
            <td>{profile.email ?? '—'}</td>
            <td><StatusBadge status={driverHasSynced(profile) ? 'synced' : 'never'} /></td>
            <td class="tabular-nums"
              >{profile.driver_affiliate_organization_data_sharing_consents?.length ?? 0}</td
            >
            <td class="text-right">
              <a class="btn btn-xs btn-ghost" href="/admin/drivers/{shortId}"
                >{canManage ? 'Manage' : 'Details'}</a
              >
            </td>
          </tr>
        {:else}
          <tr
            ><td colspan="6" class="text-center text-base-content/50 py-10">No drivers found.</td
            ></tr
          >
        {/each}
      </tbody>
    </table>
  </div>

  <Pagination page={data.params.page} pageSize={data.params.pageSize} total={data.total} />
</div>
