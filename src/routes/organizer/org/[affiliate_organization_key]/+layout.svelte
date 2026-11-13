<script lang="ts">
  import OrganizerNav from '@src/lib/components/organizer/dash/OrganizerNav.svelte';
  import UseToast from '@src/lib/components/UseToast.svelte';
  import { page } from '$app/state';
  interface Props {
    children: import('svelte').Snippet;
  }

  let { children }: Props = $props();
  const { affiliate_organization_key: affiliateOrganizationKey } = page.params;
</script>

<UseToast />
<div class="organizer-dash flex h-screen bg-base-100 w-screen">
  <OrganizerNav organizationKey={affiliateOrganizationKey} />
  <main class="flex-1 overflow-y-auto pt-20 lg:pt-8 px-6 lg:px-10 pb-8">
    {@render children()}
  </main>
</div>
