<script lang="ts">
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { _ } from 'svelte-i18n';
  import { title } from '@src/lib/stores/pageinfo';
  import { toast } from '@src/lib/toasts';
  import { formatDate, formatPhoneNumber } from '@src/lib/utils';
  import { ORGANIZATION_USER_TYPES } from '@src/lib/rbac';
  import Input from '@src/lib/components/Input.svelte';
  import ConfirmDialog from '@src/lib/components/ConfirmDialog.svelte';
  import type { PageData, ActionData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();
  title.set('Team');

  $effect(() => {
    if (form?.invited) toast({ text: $_('organizer.team.invited'), type: 'success' });
    if (form?.inviteRevoked) toast({ text: $_('organizer.team.invite-revoked'), type: 'success' });
    if (form?.removed) toast({ text: $_('organizer.team.removed'), type: 'success' });
    if (form?.roleUpdated) toast({ text: $_('organizer.team.role-updated'), type: 'success' });
    if (form?.error === 'last-lead') toast({ text: $_('organizer.team.last-lead'), type: 'error' });
    else if (form?.error) toast({ text: form.error, type: 'error' });
  });
</script>

<div class="max-w-4xl">
  <h1 class="font-serif text-3xl font-bold text-base-content mb-1">{$_('organizer.team.title')}</h1>
  <p class="text-base-content/60 mb-6">{$_('organizer.team.description')}</p>

  <section class="rounded-lg border border-base-200 bg-white p-5 mb-8">
    <h2 class="font-serif text-xl font-bold mb-3">{$_('organizer.team.invite')}</h2>
    <form method="POST" action="?/invite" use:enhance class="flex flex-wrap items-end gap-3">
      <div class="w-56">
        <Input label={$_('organizer.team.phone')} name="phone" placeholder="15555551234" required />
      </div>
      <label class="form-control">
        <span class="label-text mb-1">{$_('organizer.team.role')}</span>
        <select name="role" class="select select-bordered select-sm">
          {#each ORGANIZATION_USER_TYPES as type (type.id)}
            <option value={type.id}>{$_(`organizer.team.role.${type.id}`)}</option>
          {/each}
        </select>
      </label>
      <button type="submit" class="btn btn-neutral btn-sm">{$_('organizer.team.invite')}</button>
    </form>
  </section>

  {#if data.pendingInvites.length > 0}
    <section class="mb-8">
      <h2 class="font-serif text-xl font-bold mb-3">{$_('organizer.team.pending')}</h2>
      <div class="overflow-x-auto rounded-lg border border-base-200 bg-white">
        <table class="table table-sm">
          <thead>
            <tr>
              <th>{$_('organizer.team.phone')}</th>
              <th>{$_('organizer.team.role')}</th>
              <th>{$_('organizer.team.status')}</th>
              <th class="text-right"></th>
            </tr>
          </thead>
          <tbody>
            {#each data.pendingInvites as invite (invite.phone_number)}
              <tr class="hover">
                <td class="tabular-nums">{formatPhoneNumber(invite.phone_number)}</td>
                <td>
                  {$_(`organizer.team.role.${invite.invited_role}`)}
                </td>
                <td>
                  <span class="badge badge-ghost badge-sm"
                    >{$_('organizer.team.status.invited')}</span
                  >
                </td>
                <td class="text-right">
                  <form
                    method="POST"
                    action="?/revokeInvite"
                    use:enhance
                    id={`revoke-invite-${invite.phone_number}`}
                  >
                    <input type="hidden" name="phone" value={invite.phone_number} />
                  </form>
                  <ConfirmDialog
                    id={`rv-invite-${invite.phone_number}`}
                    title={$_('organizer.team.revoke')}
                    message={$_('organizer.team.revoke-confirm')}
                    confirmLabel={$_('organizer.team.revoke')}
                    destructive
                    onConfirm={() =>
                      (
                        document.getElementById(
                          `revoke-invite-${invite.phone_number}`
                        ) as HTMLFormElement | null
                      )?.requestSubmit()}
                    buttonClass="btn btn-xs btn-ghost text-error"
                  >
                    {#snippet trigger()}{$_('organizer.team.revoke')}{/snippet}
                  </ConfirmDialog>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>
  {/if}

  <section>
    <h2 class="font-serif text-xl font-bold mb-3">{$_('organizer.team.members')}</h2>
    <div class="overflow-x-auto rounded-lg border border-base-200 bg-white">
      <table class="table table-sm">
        <thead>
          <tr>
            <th>{$_('organizer.team.phone')}</th>
            <th>{$_('organizer.team.role')}</th>
            <th>{$_('organizer.team.joined')}</th>
            <th class="text-right"></th>
          </tr>
        </thead>
        <tbody>
          {#each data.members as member (member.user_id)}
            <tr class="hover">
              <td class="tabular-nums">
                {member.phone ? formatPhoneNumber(member.phone) : (member.profile?.email ?? '—')}
              </td>
              <td>
                <form
                  method="POST"
                  action="?/setRole"
                  use:enhance={({ formElement }) =>
                    async ({ result, update }) => {
                      await update();
                      // `update()` re-runs load on success. On a rejected change
                      // (e.g. the last-lead guard) the stored role is unchanged,
                      // so re-running load does not touch the `value` binding
                      // and the select would keep the value the server refused.
                      if (result.type === 'failure') {
                        const select = formElement.querySelector('select');
                        if (select) select.value = member.role;
                        await invalidateAll();
                      }
                    }}
                >
                  <input type="hidden" name="userId" value={member.user_id} />
                  <select
                    name="role"
                    aria-label={$_('organizer.team.role')}
                    class="select select-bordered select-xs"
                    value={member.role}
                    onchange={(event) => event.currentTarget.form?.requestSubmit()}
                  >
                    {#each ORGANIZATION_USER_TYPES as type (type.id)}
                      <option value={type.id}>{$_(`organizer.team.role.${type.id}`)}</option>
                    {/each}
                  </select>
                </form>
              </td>
              <td class="tabular-nums">
                {formatDate(member.created_at)}
              </td>
              <td class="text-right">
                <form
                  method="POST"
                  action="?/remove"
                  use:enhance
                  id={`remove-member-${member.user_id}`}
                >
                  <input type="hidden" name="userId" value={member.user_id} />
                </form>
                <ConfirmDialog
                  id={`rm-member-${member.user_id}`}
                  title={$_('organizer.team.remove')}
                  message="This person will lose access to this organization's dashboard."
                  confirmLabel={$_('organizer.team.remove')}
                  destructive
                  onConfirm={() =>
                    (
                      document.getElementById(
                        `remove-member-${member.user_id}`
                      ) as HTMLFormElement | null
                    )?.requestSubmit()}
                  buttonClass="btn btn-xs btn-ghost text-error"
                >
                  {#snippet trigger()}{$_('organizer.team.remove')}{/snippet}
                </ConfirmDialog>
              </td>
            </tr>
          {:else}
            <tr>
              <td colspan="4" class="text-center text-base-content/50 py-10">
                {$_('organizer.team.empty')}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>
</div>
