<script lang="ts">
  import { invalidateAll, goto } from '$app/navigation';
  import { page } from '$app/state';
  import { hasCapability } from '@src/lib/rbac';
  import { title } from '@src/lib/stores/pageinfo';
  import { toast } from '@src/lib/toasts';
  import { adminApiRequest } from '@src/lib/client/adminApi';
  import { formatDate, formatPersonName, formatPhoneNumber } from '@src/lib/utils';
  import ConfirmDialog from '@src/lib/components/ConfirmDialog.svelte';
  import StatusBadge from '@src/lib/components/admin/StatusBadge.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  const p = $derived(data.profile);

  const displayName = $derived(formatPersonName(data.profile, 'Driver'));
  $effect(() => {
    title.set(`Driver · ${displayName}`);
  });

  // Researchers can read this page but must not change a driver's data sharing.
  const canManage = $derived(hasCapability(page.data.roles, 'platform:manage_drivers'));

  async function deactivate(organizationKey: string) {
    const ok = await adminApiRequest('/api/admin/drivers/deactivate', 'POST', {
      driverUserId: data.userId,
      organizationKey
    });
    if (ok) {
      toast({ text: 'Driver removed from organization', type: 'success' });
      await invalidateAll();
    }
  }

  async function deleteDriver() {
    const ok = await adminApiRequest('/api/admin/drivers/delete', 'POST', {
      driverUserId: data.userId
    });
    if (ok) {
      toast({ text: 'Driver account deleted', type: 'success' });
      await goto('/admin/drivers');
    }
  }

  function orgName(o: { key: string; name: string } | null, id: string): string {
    return o?.name ?? id;
  }
</script>

<div class="max-w-4xl">
  <a href="/admin/drivers" class="text-sm text-base-content/60 hover:underline">← All drivers</a>
  <h1 class="font-serif text-3xl font-bold text-base-content mt-2 mb-6">{displayName}</h1>

  <!-- Profile -->
  <section class="rounded-lg border border-base-200 bg-white p-5 mb-6">
    <h2 class="font-serif text-xl font-bold mb-3">Profile</h2>
    <dl class="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
      <dt class="text-base-content/60">Phone</dt>
      <dd class="tabular-nums">{p.phone ? formatPhoneNumber(p.phone) : '—'}</dd>
      <dt class="text-base-content/60">Email</dt>
      <dd>{p.email ?? '—'}</dd>
      <dt class="text-base-content/60">Preferred language</dt>
      <dd>{p.preferred_language ?? '—'}</dd>
      <dt class="text-base-content/60">Last sign-in</dt>
      <dd class="tabular-nums">{formatDate(p.last_sign_in_at)}</dd>
    </dl>
  </section>

  <!-- Affiliations -->
  <section class="rounded-lg border border-base-200 bg-white p-5 mb-6">
    <h2 class="font-serif text-xl font-bold mb-3">Organization affiliations</h2>
    {#if data.affiliations.length === 0}
      <p class="text-sm text-base-content/60">Not affiliated with any organization.</p>
    {:else}
      <div class="overflow-x-auto">
        <table class="table table-sm">
          <thead>
            <tr
              ><th>Organization</th><th>Primary</th><th>Since</th>{#if canManage}<th
                  class="text-right">Actions</th
                >{/if}</tr
            >
          </thead>
          <tbody>
            {#each data.affiliations as aff (aff.affiliate_organization_id)}
              <tr>
                <td>{orgName(aff.affiliate_organizations, aff.affiliate_organization_id)}</td>
                <td>{aff.is_primary ? 'Yes' : 'No'}</td>
                <td class="tabular-nums">{formatDate(aff.created_at)}</td>
                {#if canManage}
                  <td class="text-right">
                    <ConfirmDialog
                      id={`deact-${aff.affiliate_organization_id}`}
                      title="Remove from organization?"
                      message="This deactivates the driver's affiliation and data sharing with this organization. The account is not deleted."
                      confirmLabel="Remove"
                      destructive
                      onConfirm={() => deactivate(aff.affiliate_organizations?.key ?? '')}
                      buttonClass="btn btn-xs btn-ghost text-error"
                      buttonDisabled={!aff.affiliate_organizations?.key}
                    >
                      {#snippet trigger()}Deactivate{/snippet}
                    </ConfirmDialog>
                  </td>
                {/if}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </section>

  <!-- Gig accounts -->
  <section class="rounded-lg border border-base-200 bg-white p-5 mb-6">
    <h2 class="font-serif text-xl font-bold mb-3">Gig accounts</h2>
    {#if data.argyleAccounts.length === 0}
      <p class="text-sm text-base-content/60">No connected gig accounts.</p>
    {:else}
      <div class="overflow-x-auto">
        <table class="table table-sm">
          <thead>
            <tr><th>Employer</th><th>Last synced</th><th>Status</th></tr>
          </thead>
          <tbody>
            {#each data.argyleAccounts as acct (acct.id)}
              <tr class:opacity-50={acct.deleted_at}>
                <td
                  >{acct.employer ?? '—'}{#if acct.deleted_at}
                    (removed){/if}</td
                >
                <td class="tabular-nums">{formatDate(acct.all_gigs_last_synced_at)}</td>
                <td><StatusBadge status={acct.all_gigs_last_sync_attempt_status ?? 'never'} /></td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </section>

  <!-- Danger zone -->
  {#if canManage}
    <section class="rounded-lg border border-error/30 bg-error/5 p-5">
      <h2 class="font-serif text-xl font-bold mb-2 text-error">Danger zone</h2>
      <p class="text-sm text-base-content/70 mb-3">
        Deleting permanently removes this driver's account and all their data. This cannot be
        undone.
      </p>
      <ConfirmDialog
        id="delete-driver"
        title="Delete driver account?"
        confirmLabel="Delete permanently"
        destructive
        onConfirm={deleteDriver}
        buttonClass="btn btn-error btn-sm"
        buttonDisabled={false}
      >
        {#snippet trigger()}Delete driver account{/snippet}
      </ConfirmDialog>
      <p class="text-xs text-base-content/50 mt-2">
        Notifies organizations the driver shared data with, then permanently deletes the account.
      </p>
    </section>
  {/if}
</div>
