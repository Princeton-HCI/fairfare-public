<script lang="ts">
  import { invalidateAll, goto } from '$app/navigation';
  import { page } from '$app/state';
  import { hasCapability } from '@src/lib/rbac';
  import { title } from '@src/lib/stores/pageinfo';
  import { toast } from '@src/lib/toasts';
  import { adminApiRequest } from '@src/lib/client/adminApi';
  import Input from '@src/lib/components/Input.svelte';
  import ConfirmDialog from '@src/lib/components/ConfirmDialog.svelte';
  import StatusBadge from '@src/lib/components/admin/StatusBadge.svelte';
  import DataBox from '@src/lib/components/organizer/dash/DataBox.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  const org = $derived(data.organization);
  title.set(`Org · ${data.organization.name}`);

  // Researchers can read this page; only admins can change the organization.
  const canManage = $derived(hasCapability(page.data.roles, 'platform:manage_orgs'));

  let savingDetails = $state(false);
  let savingLimits = $state(false);
  let rotating = $state(false);

  async function saveDetails(event: Event) {
    event.preventDefault();
    const fd = new FormData(event.target as HTMLFormElement);
    savingDetails = true;
    const ok = await adminApiRequest('/api/admin/organizations', 'PATCH', {
      key: org.key,
      name: fd.get('name'),
      url: fd.get('url')
    });
    savingDetails = false;
    if (ok) {
      toast({ text: 'Saved', type: 'success' });
      await invalidateAll();
    }
  }

  async function saveOrganizerSignupCode(event: Event) {
    event.preventDefault();
    const fd = new FormData(event.target as HTMLFormElement);
    const value = ((fd.get('signupCode') as string) ?? '').trim();
    // Empty clears the code (disables organizer signups), mirroring the driver field.
    const payload = value
      ? { key: org.key, signupCode: value }
      : { key: org.key, clearSignupCode: true };
    rotating = true;
    const ok = await adminApiRequest('/api/admin/organizations/rotate-code', 'POST', payload);
    rotating = false;
    if (ok) {
      toast({
        text: value ? 'Organizer signup code saved' : 'Organizer signup code removed',
        type: 'success'
      });
      await invalidateAll();
    }
  }

  async function saveDriverSignupCode(event: Event) {
    event.preventDefault();
    const fd = new FormData(event.target as HTMLFormElement);
    const ok = await adminApiRequest('/api/admin/organizations/rotate-code', 'POST', {
      key: org.key,
      driverSignupCode: fd.get('driverSignupCode')
    });
    if (ok) {
      toast({ text: 'Driver signup code updated', type: 'success' });
      await invalidateAll();
    }
  }

  async function saveLimits(event: Event) {
    event.preventDefault();
    const fd = new FormData(event.target as HTMLFormElement);
    const raw = fd.get('maxArgyleAccounts');
    const max = raw && String(raw).trim() ? Number(raw) : null;
    savingLimits = true;
    const ok = await adminApiRequest('/api/admin/organizations/argyle-config', 'PATCH', {
      organizationKey: org.key,
      maxArgyleAccounts: max
    });
    savingLimits = false;
    if (ok) {
      toast({ text: 'Argyle limits updated', type: 'success' });
      await invalidateAll();
    }
  }

  async function disconnectArgyle() {
    const ok = await adminApiRequest(
      `/api/admin/organizations/argyle-config?organizationKey=${encodeURIComponent(org.key)}`,
      'DELETE'
    );
    if (ok) {
      toast({ text: 'Argyle disconnected', type: 'success' });
      await invalidateAll();
    }
  }

  async function toggleDeleted() {
    const restore = org.status === 'deleted';
    const ok = await adminApiRequest(
      `/api/admin/organizations?key=${encodeURIComponent(org.key)}${restore ? '&restore=true' : ''}`,
      'DELETE'
    );
    if (ok) {
      toast({ text: restore ? 'Organization restored' : 'Organization deleted', type: 'success' });
      if (restore) await invalidateAll();
      else await goto('/admin/organizations');
    }
  }
</script>

<div class="max-w-4xl">
  <a href="/admin/organizations" class="text-sm text-base-content/60 hover:underline">
    ← All organizations
  </a>
  <div class="flex flex-wrap items-center gap-3 mt-2 mb-6">
    <h1 class="font-serif text-3xl font-bold text-base-content">{org.name}</h1>
    <StatusBadge status={org.status} />
    <a href="/organizer/org/{org.key}" class="btn btn-outline btn-sm ml-auto">Open dashboard</a>
  </div>

  <div class="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8 tabular-nums">
    <DataBox title="Drivers affiliated" statistic={data.counts.driverCount} round />
    <DataBox title="Organizers" statistic={data.counts.organizerCount} round />
    <DataBox title="Data-sharing consents" statistic={data.counts.consentCount} round />
  </div>

  <!-- Details -->
  <section class="rounded-lg border border-base-200 bg-white p-5 mb-6">
    <h2 class="font-serif text-xl font-bold mb-3">Details</h2>
    {#if !canManage}
      <dl class="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
        <dt class="text-base-content/60">Name</dt>
        <dd>{org.name}</dd>
        <dt class="text-base-content/60">URL</dt>
        <dd>{org.url ?? '—'}</dd>
        <dt class="text-base-content/60">Key</dt>
        <dd><code class="text-xs">{org.key}</code></dd>
      </dl>
    {:else}
      <form onsubmit={saveDetails}>
        <Input label="Name" name="name" value={org.name} required />
        <Input label="URL" name="url" type="url" value={org.url ?? ''} />
        <div class="text-sm text-base-content/60 mt-2">
          Key: <code class="text-xs">{org.key}</code> (immutable)
        </div>
        <button type="submit" class="btn btn-primary btn-sm mt-3" disabled={savingDetails}>
          {savingDetails ? 'Saving…' : 'Save details'}
        </button>
      </form>
    {/if}
  </section>

  <!-- Signup codes -->
  <section class="rounded-lg border border-base-200 bg-white p-5 mb-6">
    <h2 class="font-serif text-xl font-bold mb-3">Signup codes</h2>
    {#if !canManage}
      <dl class="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
        <dt class="text-base-content/60">Organizer signup code</dt>
        <dd class="tabular-nums">{org.hasSignupCode ? 'Set' : '—'}</dd>
        <dt class="text-base-content/60">Driver signup gate code</dt>
        <dd class="tabular-nums">{org.hasDriverSignupCode ? 'Set' : '—'}</dd>
      </dl>
    {:else}
      <div class="mb-5">
        <form onsubmit={saveOrganizerSignupCode} class="flex items-end gap-2">
          <div class="flex-1">
            <Input label="Organizer signup code" name="signupCode" value={org.signupCode ?? ''} />
          </div>
          <button type="submit" class="btn btn-neutral btn-sm" disabled={rotating}>Save</button>
        </form>
        <p class="text-sm text-base-content/50 mt-1">
          Used by organizers to sign up. Leave empty to remove (disables organizer signups).
        </p>
      </div>
      <div>
        <form onsubmit={saveDriverSignupCode} class="flex items-end gap-2">
          <div class="flex-1">
            <Input
              label="Driver signup gate code"
              name="driverSignupCode"
              value={org.driverSignupCode ?? ''}
            />
          </div>
          <button type="submit" class="btn btn-neutral btn-sm">Save</button>
        </form>
        <p class="text-sm text-base-content/50 mt-1">Leave empty to clear (no gate).</p>
      </div>
    {/if}
  </section>

  <!-- Argyle -->
  <section class="rounded-lg border border-base-200 bg-white p-5 mb-6">
    <div class="flex items-center justify-between mb-3">
      <h2 class="font-serif text-xl font-bold">Argyle</h2>
      <StatusBadge status={data.argyle.isActive ? 'active' : 'never'} />
    </div>
    {#if data.argyle.hasCredentials}
      <dl class="grid grid-cols-2 gap-2 text-sm mb-4">
        {#if canManage}
          <dt class="text-base-content/60">API key ID</dt>
          <dd><code class="text-xs">{data.argyle.apiKeyId}</code></dd>
          <dt class="text-base-content/60">Flow ID</dt>
          <dd><code class="text-xs">{data.argyle.flowId ?? '—'}</code></dd>
        {/if}
        <dt class="text-base-content/60">Accounts</dt>
        <dd class="tabular-nums">
          {data.capacity.currentCount ?? 0}{#if data.capacity.maxArgyleAccounts != null}
            &nbsp;/ {data.capacity.maxArgyleAccounts}{/if}
        </dd>
      </dl>
      {#if canManage}
        <form onsubmit={saveLimits} class="flex items-end gap-2 mb-3">
          <div class="flex-1 max-w-xs">
            <Input
              label="Max Argyle accounts"
              name="maxArgyleAccounts"
              type="number"
              value={data.argyle.maxArgyleAccounts != null
                ? String(data.argyle.maxArgyleAccounts)
                : ''}
              bottomLabel="Leave empty for no limit."
            />
          </div>
          <button type="submit" class="btn btn-neutral btn-sm mb-1" disabled={savingLimits}>
            {savingLimits ? 'Saving…' : 'Save limit'}
          </button>
        </form>
        <ConfirmDialog
          id="disconnect-argyle"
          title="Disconnect Argyle?"
          message="This removes the webhook subscription and clears the driver signup code. Drivers can no longer connect until reconfigured."
          confirmLabel="Disconnect"
          destructive
          onConfirm={disconnectArgyle}
          buttonClass="btn btn-outline btn-error btn-sm"
        >
          {#snippet trigger()}Disconnect Argyle{/snippet}
        </ConfirmDialog>
      {/if}
    {:else}
      <p class="text-sm text-base-content/60">
        No Argyle credentials configured. Connect credentials via the organizer settings flow or the
        admin API.
      </p>
    {/if}
  </section>

  <!-- Danger zone -->
  {#if canManage}
    <section class="rounded-lg border border-error/30 bg-error/5 p-5">
      <h2 class="font-serif text-xl font-bold mb-2 text-error">Danger zone</h2>
      {#if org.status === 'deleted'}
        <p class="text-sm text-base-content/70 mb-3">
          This organization is soft-deleted and hidden from organizers.
        </p>
        <button class="btn btn-outline btn-sm" onclick={toggleDeleted}>Restore organization</button>
      {:else}
        <p class="text-sm text-base-content/70 mb-3">
          Soft-deleting hides this organization from organizers. It can be restored later.
        </p>
        <ConfirmDialog
          id="delete-org"
          title="Soft-delete organization?"
          message={`"${org.name}" will be hidden from organizers. You can restore it later.`}
          confirmLabel="Soft-delete"
          destructive
          onConfirm={toggleDeleted}
          buttonClass="btn btn-error btn-sm"
        >
          {#snippet trigger()}Soft-delete organization{/snippet}
        </ConfirmDialog>
      {/if}
    </section>
  {/if}
</div>
