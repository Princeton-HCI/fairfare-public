<script lang="ts">
  import { title } from '@src/lib/stores/pageinfo';

  title.set('Organizer | Definitions');
</script>

<div>
  <h1 class="font-serif text-2xl font-medium text-base-content">Definitions</h1>
  <p class="text-sm text-base-content/50 mt-1 mb-6">
    How we calculate the data terms used across reports and analysis.
  </p>

  <dl class="divide-y divide-base-200">
    <div class="py-4">
      <dt class="font-semibold text-base-content">Customer Charge (with tips)</dt>
      <dd class="text-base-content/60 mt-1">Base customer charge + fees (+ tips)</dd>
    </div>
    <div class="py-4">
      <dt class="font-semibold text-base-content">Driver Income (with tips)</dt>
      <dd class="text-base-content/60 mt-1">
        Base driver pay + bonus + miscellaneous payments - miscellaneous charges (+ tips)
      </dd>
    </div>
    <div class="py-4">
      <dt class="font-semibold text-base-content">Trip Duration</dt>
      <dd class="text-base-content/60 mt-1">Number of hours with a passenger</dd>
    </div>
    <div class="py-4">
      <dt class="font-semibold text-base-content">Trip Distance</dt>
      <dd class="text-base-content/60 mt-1">Number of miles with a passenger</dd>
    </div>
  </dl>
</div>
