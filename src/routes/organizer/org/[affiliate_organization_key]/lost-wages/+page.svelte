<script lang="ts">
  import { title } from '@src/lib/stores/pageinfo';
  import DriverTable from '@src/lib/components/organizer/dash/DriverTable.svelte';

  let { data } = $props();
  const { profiles } = data;

  if (!profiles) {
    throw new Error('No profiles found');
  }

  title.set('Organizer | Lost Wages Report');

  let desc = 'Select the driver for report generation';
  let baseURL = `lost-wages`;
</script>

<div>
  <h1 class="font-serif text-2xl font-medium text-base-content">Lost Wages Report Generator</h1>
  <p class="text-sm text-base-content/50 mt-1 mb-6">
    Select a driver to calculate estimated lost earnings during deactivation periods.
  </p>
  <DriverTable {profiles} {desc} {baseURL} />
</div>
