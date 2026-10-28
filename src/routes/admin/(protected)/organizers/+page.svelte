<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { page } from '$app/state';
  import { title } from '@src/lib/stores/pageinfo';
  import { toast } from '@src/lib/toasts';
  import { adminApiRequest, adminApiRequestJson } from '@src/lib/client/adminApi';
  import { formatDate, formatPersonName, formatPhoneNumber } from '@src/lib/utils';
  import { hasCapability, ORGANIZATION_USER_TYPES, userTypeLabel } from '@src/lib/rbac';
  import Input from '@src/lib/components/Input.svelte';
  import ConfirmDialog from '@src/lib/components/ConfirmDialog.svelte';
  import SearchBar from '@src/lib/components/admin/SearchBar.svelte';
  import Pagination from '@src/lib/components/admin/Pagination.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  title.set('Organizers');

  // Researchers can read this page; only admins can change anything.
  const canManage = $derived(hasCapability(page.data.roles, 'platform:manage_users'));

  let adding = $state(false);

  async function addWhitelist(event: Event) {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const fd = new FormData(form);
    adding = true;
    const result = await adminApiRequestJson<{ requestedRoleApplied?: boolean }>(
      '/api/admin/organizers/whitelist',
      'POST',
      {
        phoneNumber: fd.get('phoneNumber'),
        organizationId: fd.get('organizationId'),
        role: fd.get('role')
      }
    );
    adding = false;
    if (result) {
      // Whitelisting someone who has already joined does not change the role
      // they hold, so say so rather than implying a promotion that did not
      // happen — their role is changed from the organization's team page.
      toast(
        result.requestedRoleApplied === false
          ? {
              text: 'Whitelist entry added. This person is already a member, so their role is unchanged.',
              type: 'info'
            }
          : { text: 'Whitelist entry added', type: 'success' }
      );
      form.reset();
      await invalidateAll();
    }
  }

  async function removeWhitelist(phoneNumber: string, organizationId: string) {
    const params = new URLSearchParams({ phoneNumber, organizationId });
    const ok = await adminApiRequest(`/api/admin/organizers/whitelist?${params}`, 'DELETE');
    if (ok) {
      toast({ text: 'Whitelist entry removed', type: 'success' });
      await invalidateAll();
    }
  }

  async function updateRole(userId: string, organizationId: string, role: string) {
    const ok = await adminApiRequest('/api/admin/organizers/affiliation', 'PATCH', {
      userId,
      organizationId,
      role
    });
    if (ok) {
      toast({ text: 'Role updated', type: 'success' });
    }
    // Reload either way: on success to reflect the change, on rejection (a
    // database guard or a lost race) to reset the select back to the stored role.
    await invalidateAll();
  }

  async function revokeAffiliation(userId: string, organizationId: string) {
    const params = new URLSearchParams({ userId, organizationId });
    const ok = await adminApiRequest(`/api/admin/organizers/affiliation?${params}`, 'DELETE');
    if (ok) {
      toast({ text: 'Affiliation revoked', type: 'success' });
      await invalidateAll();
    }
  }

  // Organizers usually have no name (first_name/last_initial are driver
  // identity fields), so fall back to email, then a dash.
  const organizerLabel = (
    p: { first_name: string | null; last_initial: string | null; email: string | null } | null
  ): string => formatPersonName(p, p?.email ?? '—');
</script>

<div class="max-w-5xl">
  <h1 class="font-serif text-3xl font-bold text-base-content mb-1">Organizers</h1>
  <p class="text-base-content/60 mb-6">
    Whitelist phone numbers so they can log in as organizers, choose the role they get on first
    login, and manage their organization memberships.
  </p>

  {#if canManage}
    <!-- Add to whitelist -->
    <section class="rounded-lg border border-base-200 bg-white p-5 mb-8">
      <h2 class="font-serif text-xl font-bold mb-3">Add to whitelist</h2>
      <form onsubmit={addWhitelist} class="flex flex-wrap items-end gap-3">
        <div class="w-56">
          <Input label="Phone number" name="phoneNumber" placeholder="+15555551234" required />
        </div>
        <div class="form-control">
          <label class="label" for="org-select">
            <span class="label-text">Organization</span>
          </label>
          <select
            id="org-select"
            name="organizationId"
            class="select select-bordered select-sm"
            required
          >
            <option value="" disabled selected>Select organization…</option>
            {#each data.orgs as org}
              <option value={org.id}>{org.name} ({org.key})</option>
            {/each}
          </select>
        </div>
        <div class="form-control">
          <label class="label" for="role-select">
            <span class="label-text">Role</span>
          </label>
          <select id="role-select" name="role" class="select select-bordered select-sm">
            {#each ORGANIZATION_USER_TYPES as type}
              <option value={type.id} selected={type.id === 'organizer'}>{type.label}</option>
            {/each}
          </select>
        </div>
        <button type="submit" class="btn btn-neutral btn-sm" disabled={adding}>
          {adding ? 'Adding…' : 'Add'}
        </button>
      </form>
      <p class="text-sm text-base-content/50 mt-2">
        The person logs in at /organizer/login with their phone and the organization's signup code.
        Choose "Organizer administrator" for the first administrator of a new organization.
      </p>
    </section>
  {/if}

  <!-- Whitelist table -->
  <section class="mb-10">
    <div class="flex items-center justify-between gap-3 mb-3">
      <h2 class="font-serif text-xl font-bold">Phone whitelist</h2>
      <SearchBar value={data.params.q} placeholder="Search phone…" />
    </div>
    <div class="overflow-x-auto rounded-lg border border-base-200 bg-white">
      <table class="table table-sm">
        <thead>
          <tr>
            <th>Phone</th>
            <th>Organization</th>
            <th>Invited role</th>
            <th>Added</th>
            {#if canManage}<th class="text-right">Actions</th>{/if}
          </tr>
        </thead>
        <tbody>
          {#each data.whitelist as entry (entry.phone_number + entry.affiliate_organization_id)}
            <tr class="hover">
              <td class="tabular-nums">{formatPhoneNumber(entry.phone_number)}</td>
              <td>{entry.affiliate_organizations?.name ?? entry.affiliate_organization_id}</td>
              <td>{userTypeLabel('organization', entry.invited_role)}</td>
              <td class="tabular-nums">{formatDate(entry.created_at)}</td>
              {#if canManage}
                <td class="text-right">
                  <ConfirmDialog
                    id={`rm-wl-${entry.phone_number}-${entry.affiliate_organization_id}`}
                    title="Remove whitelist entry?"
                    message={`${formatPhoneNumber(entry.phone_number)} will no longer be able to log in as an organizer for this organization.`}
                    confirmLabel="Remove"
                    destructive
                    onConfirm={() =>
                      removeWhitelist(entry.phone_number, entry.affiliate_organization_id)}
                    buttonClass="btn btn-xs btn-ghost text-error"
                  >
                    {#snippet trigger()}Remove{/snippet}
                  </ConfirmDialog>
                </td>
              {/if}
            </tr>
          {:else}
            <tr
              ><td colspan="5" class="text-center text-base-content/50 py-10"
                >No whitelist entries.</td
              ></tr
            >
          {/each}
        </tbody>
      </table>
    </div>
    <Pagination page={data.params.page} pageSize={data.params.pageSize} total={data.total} />
  </section>

  <!-- Affiliations -->
  <section>
    <h2 class="font-serif text-xl font-bold mb-3">Active memberships</h2>
    <div class="overflow-x-auto rounded-lg border border-base-200 bg-white">
      <table class="table table-sm">
        <thead>
          <tr>
            <th>Organizer</th>
            <th>Phone</th>
            <th>Organization</th>
            <th>Role</th>
            {#if canManage}<th class="text-right">Actions</th>{/if}
          </tr>
        </thead>
        <tbody>
          {#each data.affiliations as aff (aff.user_id + aff.organization_id)}
            <tr class="hover">
              <td class="font-medium">{organizerLabel(aff.profiles)}</td>
              <td class="tabular-nums"
                >{aff.profiles?.phone ? formatPhoneNumber(aff.profiles.phone) : '—'}</td
              >
              <td>{aff.affiliate_organizations?.name ?? aff.organization_id}</td>
              <td>
                {#if canManage}
                  <select
                    class="select select-bordered select-xs"
                    value={aff.role}
                    aria-label="Organization role"
                    onchange={(event) =>
                      updateRole(
                        aff.user_id,
                        aff.organization_id,
                        (event.currentTarget as HTMLSelectElement).value
                      )}
                  >
                    {#each ORGANIZATION_USER_TYPES as type}
                      <option value={type.id}>{type.label}</option>
                    {/each}
                  </select>
                {:else}
                  {userTypeLabel('organization', aff.role)}
                {/if}
              </td>
              {#if canManage}
                <td class="text-right">
                  <ConfirmDialog
                    id={`rm-aff-${aff.user_id}-${aff.organization_id}`}
                    title="Revoke membership?"
                    message="This organizer will lose access to this organization's dashboard."
                    confirmLabel="Revoke"
                    destructive
                    onConfirm={() => revokeAffiliation(aff.user_id, aff.organization_id)}
                    buttonClass="btn btn-xs btn-ghost text-error"
                  >
                    {#snippet trigger()}Revoke{/snippet}
                  </ConfirmDialog>
                </td>
              {/if}
            </tr>
          {:else}
            <tr
              ><td colspan="5" class="text-center text-base-content/50 py-10">No memberships.</td
              ></tr
            >
          {/each}
        </tbody>
      </table>
    </div>
  </section>
</div>
