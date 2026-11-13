<script lang="ts">
  import { page } from '$app/state';
  import { title } from '@src/lib/stores/pageinfo';
  import OrganizerMenu from '@src/lib/components/organizer/dash/OrganizerMenu.svelte';

  let { data } = $props();
  const { totalDriversSignedUp, profiles, organizationName } = data;

  if (!profiles) {
    throw new Error('No profiles found');
  }

  const organizationKey = page.params.affiliate_organization_key;

  title.set('Organizer | Drivers');
</script>

<div>
  <h1 class="font-serif text-2xl font-medium text-base-content">{organizationName}</h1>
  <p class="text-sm text-base-content/50 mt-1">
    Overview of driver enrollment and available tools.
  </p>

  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
    <div class="bg-white/80 rounded-lg p-5 border-l-[3px] border-primary">
      <p class="text-3xl font-bold text-base-content" data-testid="drivers-successfully-shared">
        {profiles.length}
      </p>
      <p class="text-sm text-base-content/50 mt-1">
        Drivers successfully shared data with {organizationName}
      </p>
    </div>
    <div class="bg-white/80 rounded-lg p-5 border-l-[3px] border-accent">
      <p class="text-3xl font-bold text-base-content" data-testid="drivers-not-linked">
        {totalDriversSignedUp - profiles.length}
      </p>
      <p class="text-sm text-base-content/50 mt-1">
        Drivers chose to share but did not link rideshare accounts
      </p>
    </div>
  </div>

  <div class="mt-8">
    <h2 class="text-sm font-semibold uppercase tracking-wide text-base-content/50 mb-3">Tools</h2>
    <OrganizerMenu {organizationKey} />
  </div>
</div>
