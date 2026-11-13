<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { page } from '$app/state';
  import { title } from '@src/lib/stores/pageinfo';
  import { toast } from '@src/lib/toasts';
  import { adminApiRequest } from '@src/lib/client/adminApi';
  import { formatDate, formatPersonName } from '@src/lib/utils';
  import {
    ASSIGNABLE_PLATFORM_USER_TYPES,
    capabilityForPlatformRole,
    hasCapability,
    userTypeLabel,
    type AssignablePlatformRole
  } from '@src/lib/rbac';
  import Input from '@src/lib/components/Input.svelte';
  import ConfirmDialog from '@src/lib/components/ConfirmDialog.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  title.set('Platform users');

  const canManage = $derived(hasCapability(page.data.roles, 'platform:manage_users'));
  const canManageAdmins = $derived(hasCapability(page.data.roles, 'platform:manage_admins'));

  /** Roles the signed-in admin may hand out — `admin` needs its own capability. */
  const assignableTypes = $derived(
    ASSIGNABLE_PLATFORM_USER_TYPES.filter((type) =>
      hasCapability(page.data.roles, capabilityForPlatformRole(type.id))
    )
  );

  /**
   * Both the role a row holds now and the role it would move to are gated, so a
   * caller who cannot manage admins sees no control that would 403.
   */
  const canEdit = (userId: string, role: string): boolean =>
    canManage &&
    userId !== data.currentUserId &&
    hasCapability(page.data.roles, capabilityForPlatformRole(role));

  let adding = $state(false);
  let addRole = $state<AssignablePlatformRole>('researcher');
  let pendingUserId = $state<string | null>(null);

  async function addPlatformUser(event: Event) {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const fd = new FormData(form);
    adding = true;
    const ok = await adminApiRequest('/api/admin/platform-users', 'POST', {
      email: fd.get('email'),
      password: fd.get('password'),
      role: addRole
    });
    adding = false;
    if (ok) {
      // One message for both outcomes: the endpoint either creates the account
      // or resets the password of the one that email already has.
      toast({ text: `${userTypeLabel('platform', addRole)} saved`, type: 'success' });
      form.reset();
      await invalidateAll();
    }
  }

  async function changeRole(userId: string, role: AssignablePlatformRole) {
    pendingUserId = userId;
    const ok = await adminApiRequest('/api/admin/platform-users', 'PATCH', { userId, role });
    pendingUserId = null;
    if (ok) toast({ text: `Role changed to ${userTypeLabel('platform', role)}`, type: 'success' });
    // Reload either way: a refused change leaves the select showing the role the
    // admin picked, so it has to snap back to what the server actually stores.
    await invalidateAll();
  }

  async function removePlatformUser(userId: string) {
    const params = new URLSearchParams({ userId });
    const ok = await adminApiRequest(`/api/admin/platform-users?${params}`, 'DELETE');
    if (ok) {
      toast({ text: 'Platform user removed', type: 'success' });
      await invalidateAll();
    }
  }

  const displayName = (
    p: { first_name: string | null; last_initial: string | null; email: string | null } | null
  ): string => formatPersonName(p, p?.email ?? '—');
</script>

<div class="max-w-5xl">
  <h1 class="font-serif text-3xl font-bold text-base-content mb-1">Platform users</h1>
  <p class="text-base-content/60 mb-6">
    Staff whose access comes from a platform role rather than an organization membership. They sign
    in at <a href="/admin/login" class="underline">/admin/login</a> with an email and password.
  </p>

  {#if canManage}
    <section class="rounded-lg border border-base-200 bg-white p-5 mb-8">
      <h2 class="font-serif text-xl font-bold mb-3">Add platform user</h2>
      <form onsubmit={addPlatformUser} class="flex flex-wrap items-end gap-3">
        <div class="w-72">
          <Input
            label="Email"
            name="email"
            type="email"
            placeholder="person@example.org"
            required
          />
        </div>
        <div class="w-56">
          <Input label="Password" name="password" type="password" minlength={8} required />
        </div>
        <label class="form-control w-56">
          <span class="label-text mb-1">Role</span>
          <select class="select select-bordered select-sm" bind:value={addRole}>
            {#each assignableTypes as type}
              <option value={type.id}>{type.label}</option>
            {/each}
          </select>
        </label>
        <button type="submit" class="btn btn-neutral btn-sm" disabled={adding}>
          {adding ? 'Saving…' : 'Add'}
        </button>
      </form>
      <!--
        Every role's description is rendered into the same grid cell and all but
        the selected one hidden with `invisible`, so the block keeps the height
        of the longest one at any width. Swapping a single paragraph's text
        instead would resize it on each change and shove the rest of the page up
        and down.
      -->
      <div class="grid mt-2">
        {#each assignableTypes as type}
          <p
            class="col-start-1 row-start-1 text-sm text-base-content/50"
            class:invisible={type.id !== addRole}
            aria-hidden={type.id !== addRole}
          >
            {type.description}
          </p>
        {/each}
      </div>
      <p class="text-sm text-base-content/50 mt-2">
        If no account exists for the email yet, one is created with this password (at least 8
        characters). No invitation email is sent, so pass the password on yourself. Re-submitting
        the email of someone who already has this role resets their password; to change an existing
        user's role, use the list below.
      </p>
      {#if !canManageAdmins}
        <p class="text-sm text-base-content/50 mt-2">
          Only developer administrators can add or remove other administrators.
        </p>
      {/if}
    </section>
  {/if}

  <section>
    <h2 class="font-serif text-xl font-bold mb-3">Researchers and administrators</h2>
    <div class="overflow-x-auto rounded-lg border border-base-200 bg-white">
      <table class="table table-sm">
        <thead>
          <tr>
            <th>User</th>
            <th>Email</th>
            <th>Role</th>
            <th>Organizations</th>
            <th>Last sign-in</th>
            <th>Added</th>
            {#if canManage}<th class="text-right">Actions</th>{/if}
          </tr>
        </thead>
        <tbody>
          {#each data.users as user (user.user_id)}
            <tr class="hover">
              <td class="font-medium">
                {displayName(user.profile)}
                {#if user.user_id === data.currentUserId}
                  <span class="text-xs text-base-content/50">(you)</span>
                {/if}
              </td>
              <td>{user.profile?.email ?? '—'}</td>
              <td>
                {#if canEdit(user.user_id, user.role)}
                  <select
                    class="select select-bordered select-xs"
                    aria-label={`Role for ${displayName(user.profile)}`}
                    value={user.role}
                    disabled={pendingUserId === user.user_id}
                    onchange={(event) =>
                      changeRole(user.user_id, event.currentTarget.value as AssignablePlatformRole)}
                  >
                    {#each assignableTypes as type}
                      <option value={type.id}>{type.label}</option>
                    {/each}
                  </select>
                {:else}
                  <span
                    class="badge badge-sm {user.role === 'admin' ? 'badge-neutral' : 'badge-ghost'}"
                  >
                    {userTypeLabel('platform', user.role)}
                  </span>
                {/if}
              </td>
              <td class="tabular-nums">{user.membershipCount}</td>
              <td class="tabular-nums">{formatDate(user.profile?.last_sign_in_at ?? null)}</td>
              <td class="tabular-nums">{formatDate(user.created_at)}</td>
              {#if canManage}
                <td class="text-right">
                  {#if canEdit(user.user_id, user.role)}
                    <ConfirmDialog
                      id={`rm-platform-user-${user.user_id}`}
                      title={`Remove ${userTypeLabel('platform', user.role).toLowerCase()}?`}
                      message="This person will lose access to the admin area and every organization dashboard. Their account and password are kept."
                      confirmLabel="Remove"
                      destructive
                      onConfirm={() => removePlatformUser(user.user_id)}
                      buttonClass="btn btn-xs btn-ghost text-error"
                    >
                      {#snippet trigger()}Remove{/snippet}
                    </ConfirmDialog>
                  {:else if user.user_id === data.currentUserId}
                    <span class="text-xs text-base-content/50">Your own account</span>
                  {:else}
                    <span class="text-xs text-base-content/50">Administrators only</span>
                  {/if}
                </td>
              {/if}
            </tr>
          {:else}
            <tr
              ><td colspan={canManage ? 7 : 6} class="text-center text-base-content/50 py-10"
                >No researchers or administrators yet.</td
              ></tr
            >
          {/each}
        </tbody>
      </table>
    </div>
    <p class="text-sm text-base-content/50 mt-3">
      The last administrator cannot be removed or demoted — grant another one first. Recover an
      account with no administrators left using <code>pnpm seed:admins</code>.
    </p>
  </section>
</div>
