<script lang="ts">
  import { page } from '$app/state';
  import { hasCapability } from '@src/lib/rbac';
  import NavButton from './NavButton.svelte';

  interface Props {
    organizationKey: string;
  }

  let { organizationKey }: Props = $props();

  // Mirror the sidebar: settings and team are for organizer administrators only.
  const canManageSettings = $derived(
    hasCapability(page.data.roles, 'org:manage_argyle_settings', organizationKey)
  );
  const canManageMembers = $derived(
    hasCapability(page.data.roles, 'org:manage_members', organizationKey)
  );
</script>

<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
  <NavButton
    url={`/organizer/org/${organizationKey}/lost-wages`}
    name="Lost Wages"
    description="Generate lost wages reports for drivers"
    borderClass="border-l-[#4aa125]"
  />
  <NavButton
    url={`/organizer/org/${organizationKey}/sick-time`}
    name="Sick Time"
    description="Calculate driver sick time accruals"
    borderClass="border-l-[#8cad25]"
  />
  <NavButton
    url={`/organizer/org/${organizationKey}/policy-analysis`}
    name="Policy Analysis"
    description="Analyze trip data across platforms"
    borderClass="border-l-[#CDB924]"
  />
  <NavButton
    url={`/organizer/org/${organizationKey}/definitions`}
    name="Definitions"
    description="Data term definitions and methodology"
    borderClass="border-l-[#A052A6]"
  />
  {#if canManageSettings}
    <NavButton
      url={`/organizer/org/${organizationKey}/argyle-settings`}
      name="Argyle Settings"
      description="Manage credentials, signup rules, limits, and driver access"
      borderClass="border-l-[#2E7D99]"
    />
  {/if}
  {#if canManageMembers}
    <NavButton
      url={`/organizer/org/${organizationKey}/team`}
      name="Team"
      description="Add or remove organizers and set their roles"
      borderClass="border-l-[#2E7D99]"
    />
  {/if}
</div>
