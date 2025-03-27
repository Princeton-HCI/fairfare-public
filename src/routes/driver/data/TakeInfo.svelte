<script lang="ts">
  import BottomDrawer from '@src/lib/components/BottomDrawer.svelte';
  import CsvDataDownloadButton from '@src/lib/components/driver/CsvDataDownloadButton.svelte';
  import MinimumAverageMaxiumumTakeChart from '@src/lib/components/driver/MinimumAverageMaxiumumTakeChart.svelte';
  import { title } from '@src/lib/stores/pageinfo';
  import { isDemoMode } from '@src/lib/utils';

  import { _ } from 'svelte-i18n';

  interface Props {
    averagePlatformTakePctString: string;
    minPlatformTakeString: string;
    maxPlatformTakeString: string;
    gigsLength: number;
    monthsSinceMinDateToShow: number;
    userId: string;
    phoneNumberLastTwo: string;
    hasError: boolean;
    errorI18nKey: string;
    averagePlatformTakePct: number;
  }

  let {
    averagePlatformTakePctString,
    minPlatformTakeString,
    maxPlatformTakeString,
    gigsLength,
    monthsSinceMinDateToShow,
    userId,
    phoneNumberLastTwo,
    hasError,
    errorI18nKey,
    averagePlatformTakePct
  }: Props = $props();

  title.set('Take Info');
</script>

<!-- TODO: use import { error } from '@sveltejs/kit'; on the server side to handle errors -->
{#if hasError}
  <div class="text-center text-xl font-bold whitespace-normal text-error">
    {$_(`driver.survey.takeinfo.errors.${errorI18nKey}`)}
  </div>
{:else}
  <div class="prose">
    <!-- FIXME: consider how we want to break this up by uber/lyft -->

    <div
      class="relative my-auto flex justify-center items-center mb-6"
      style="--progress: {averagePlatformTakePct}"
    >
      <svg width="152" height="152" viewBox="0 0 250 250" class="circular-progress">
        <circle class="bg"></circle>
        <circle class="fg"></circle>
      </svg>
      <div class="text-5xl absolute inset-0 flex justify-center items-center font-serif">
        <p class="m-0 leading-none">
          {`${averagePlatformTakePctString}%`}
        </p>
      </div>
    </div>

    <h1 class="text-center">{$_('driver.data.ubers-average-take-rate-on-your-fares')}</h1>

    <div class="bg-white p-4 leading-none">
      <div>
        <div class="flex justify-between">
          <span>{$_('driver.data.highest-take-rate')}</span>
          <span class="font-bold">{maxPlatformTakeString}%</span>
        </div>
        <!-- outer slider -->
        <div class="bg-green-100 mt-3 h-1 rounded">
          <!-- inner slider -->
          <div class="bg-green-500 h-1 rounded" style={`width: ${maxPlatformTakeString}%;`}></div>
        </div>
      </div>
      <div class="pt-4 border-t mt-4">
        <div class="flex justify-between">
          <span>{$_('driver.data.lowest-take-rate')}</span>
          <span class="font-bold">{minPlatformTakeString}%</span>
        </div>
        <!-- outer slider -->
        <div class="bg-orange-100 mt-3 h-1 rounded">
          <!-- inner slider -->
          <div class="bg-orange-500 h-1 rounded" style={`width: ${minPlatformTakeString}%;`}></div>
        </div>
      </div>
    </div>

    <p class="text-center">
      {$_('driver.survey.takeinfo.this-is-based-on')}
      <span class="font-bold">
        {$_('driver.survey.takeinfo.rides', { values: { n: gigsLength } })}
      </span>
      <!-- TODO: pass the count here to make spanish grammar work for a single month -->
      {$_('driver.survey.takeinfo.you-completed-over-the-past')}
      <span class="font-bold"
        >{$_('driver.survey.takeinfo.months', { values: { n: monthsSinceMinDateToShow } })}</span
      >.
    </p>

    <MinimumAverageMaxiumumTakeChart
      {minPlatformTakeString}
      {averagePlatformTakePctString}
      {maxPlatformTakeString}
    />

    <BottomDrawer orientation="vertical">
      {#if isDemoMode}
        <a class="btn btn-disabled" href="/driver/settings/org">
          {$_('components.driver.csvDataDownloadButton.download-data')}
        </a>
      {:else}
        <CsvDataDownloadButton {userId} {phoneNumberLastTwo} />
      {/if}
      <a class="btn btn-ghost {isDemoMode && 'btn-disabled'}" href="/driver/settings/org">
        {$_('driver.data.manage-data-sharing')}
      </a>
    </BottomDrawer>
  </div>
{/if}

<style>
  .circular-progress {
    --size: 250px;
    --half-size: calc(var(--size) / 2);
    --stroke-width: 16px;

    --radius: calc((var(--size) - var(--stroke-width)) / 2);
    --circumference: calc(var(--radius) * pi * 2);
    --dash: calc((var(--progress) * var(--circumference)) / 100);
  }

  .circular-progress circle {
    cx: var(--half-size);
    cy: var(--half-size);
    r: var(--radius);
    stroke-width: var(--stroke-width);
    fill: none;
  }

  .circular-progress circle.bg {
    stroke: #ddd;
  }

  .circular-progress circle.fg {
    transform: rotate(-90deg);
    transform-origin: var(--half-size) var(--half-size);
    stroke-dasharray: var(--dash) calc(var(--circumference) - var(--dash));
    stroke: #000;
  }
</style>
