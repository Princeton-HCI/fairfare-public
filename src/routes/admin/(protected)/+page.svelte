<script lang="ts">
  import { page } from '$app/state';
  import DataBox from '@src/lib/components/organizer/dash/DataBox.svelte';
  import { title } from '@src/lib/stores/pageinfo';
  import { hasCapability, userTypeLabel } from '@src/lib/rbac';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  const stats = $derived(data.stats);

  title.set('Admin overview');

  // Researchers can open every admin page read-only; only admins can change
  // anything. Say so in the copy instead of promising "Manage" to everyone.
  const roles = $derived(page.data.roles);
  const canManageOrgs = $derived(hasCapability(roles, 'platform:manage_orgs'));
  const canManageUsers = $derived(hasCapability(roles, 'platform:manage_users'));
  const canManageDrivers = $derived(hasCapability(roles, 'platform:manage_drivers'));
  const canViewAuditLog = $derived(hasCapability(roles, 'platform:view_audit_log'));
  const readOnly = $derived(!canManageOrgs && !canManageUsers && !canManageDrivers);
  const roleLabel = $derived(userTypeLabel('platform', roles?.platformRole));

  const cards = $derived([
    { title: 'Active organizations', statistic: stats.activeOrganizations },
    { title: 'Deleted organizations', statistic: stats.deletedOrganizations },
    { title: 'Organizers', statistic: stats.organizers },
    { title: 'Registered profiles', statistic: stats.profiles },
    { title: 'Connected gig accounts', statistic: stats.connectedAccounts },
    { title: 'Synced gig accounts', statistic: stats.syncedAccounts }
  ]);
</script>

<div class="max-w-6xl">
  <h1 class="font-serif text-3xl font-bold text-base-content mb-1">Platform overview</h1>
  <p class="text-base-content/60 mb-6">
    {readOnly
      ? `Cross-organization analytics. You are signed in as a ${roleLabel} with read-only access.`
      : 'Cross-organization moderation and analytics.'}
  </p>

  <div class="grid grid-cols-2 lg:grid-cols-3 gap-4 tabular-nums">
    {#each cards as card}
      <DataBox title={card.title} statistic={card.statistic} round />
    {/each}
  </div>

  <div class="mt-8 flex flex-wrap gap-3">
    <a href="/admin/organizations" class="btn btn-neutral btn-sm">
      {canManageOrgs ? 'Manage organizations' : 'View organizations'}
    </a>
    <a href="/admin/organizers" class="btn btn-outline btn-sm">
      {canManageUsers ? 'Manage organizers' : 'View organizers'}
    </a>
    <a href="/admin/platform-users" class="btn btn-outline btn-sm">
      {canManageUsers ? 'Manage platform users' : 'View platform users'}
    </a>
    <a href="/admin/drivers" class="btn btn-outline btn-sm">
      {canManageDrivers ? 'Manage drivers' : 'View drivers'}
    </a>
    {#if canViewAuditLog}
      <a href="/admin/audit" class="btn btn-outline btn-sm">View audit log</a>
    {/if}
  </div>
</div>
