<script lang="ts">
  import BottomDrawer from '@src/lib/components/BottomDrawer.svelte';
  import CsvDataDownloadButton from '@src/lib/components/driver/CsvDataDownloadButton.svelte';
  import MinimumAverageMaxiumumTakeChart from '@src/lib/components/driver/MinimumAverageMaxiumumTakeChart.svelte';
  import { title } from '@src/lib/stores/pageinfo';

  import { _ } from 'svelte-i18n';

  type PlatformStats = {
    employer: string;
    averagePlatformTakePct: number;
    averagePlatformTakePctString: string;
    minPlatformTakeString: string | undefined;
    maxPlatformTakeString: string | undefined;
    gigsLength: number;
  };

  type AggregateStats = Omit<PlatformStats, 'employer'>;

  interface Props {
    aggregate: AggregateStats | null;
    byPlatform: PlatformStats[];
    unsupportedEmployers: string[];
    monthsSinceMinDateToShow: number;
    userId: string;
    phoneNumberLastTwo: string;
    hasError: boolean;
    errorI18nKey: string;
  }

  let {
    aggregate,
    byPlatform,
    unsupportedEmployers,
    monthsSinceMinDateToShow,
    userId,
    phoneNumberLastTwo,
    hasError,
    errorI18nKey
  }: Props = $props();

  title.set('Take Info');

  // Hide the aggregate when there's only one supported platform — it would
  // duplicate that platform's section.
  const showAggregate = byPlatform.length > 1 && aggregate !== null;
</script>

<!-- TODO: use import { error } from '@sveltejs/kit'; on the server side to handle errors -->
{#if hasError}
  <div class="text-center text-xl font-bold whitespace-normal text-error">
    {$_(`driver.survey.takeinfo.errors.${errorI18nKey}`)}
  </div>
{:else}
  <div class="prose">
    {#each byPlatform as platform (platform.employer)}
      <section class="mb-8">
        <div
          class="relative my-auto flex justify-center items-center mb-6"
          style="--progress: {platform.averagePlatformTakePct}"
        >
          <svg width="152" height="152" viewBox="0 0 250 250" class="circular-progress">
            <circle class="bg"></circle>
            <circle class="fg"></circle>
          </svg>
          <div class="text-5xl absolute inset-0 flex justify-center items-center font-serif">
            <p class="m-0 leading-none">
              {`${platform.averagePlatformTakePctString}%`}
            </p>
          </div>
        </div>

        <h1 class="text-center">
          {$_('driver.data.platform-take-rate-title', {
            values: { employer: platform.employer }
          })}
        </h1>

        <div class="bg-white p-4 leading-none">
          <div>
            <div class="flex justify-between">
              <span>{$_('driver.data.highest-take-rate')}</span>
              <span class="font-bold">{platform.maxPlatformTakeString}%</span>
            </div>
            <!-- outer slider -->
            <div class="bg-green-100 mt-3 h-1 rounded">
              <!-- inner slider -->
              <div
                class="bg-green-500 h-1 rounded"
                style={`width: ${platform.maxPlatformTakeString}%;`}
              ></div>
            </div>
          </div>
          <div class="pt-4 border-t mt-4">
            <div class="flex justify-between">
              <span>{$_('driver.data.lowest-take-rate')}</span>
              <span class="font-bold">{platform.minPlatformTakeString}%</span>
            </div>
            <!-- outer slider -->
            <div class="bg-orange-100 mt-3 h-1 rounded">
              <!-- inner slider -->
              <div
                class="bg-orange-500 h-1 rounded"
                style={`width: ${platform.minPlatformTakeString}%;`}
              ></div>
            </div>
          </div>
        </div>

        <p class="text-center">
          {$_('driver.survey.takeinfo.this-is-based-on')}
          <span class="font-bold">
            {$_('driver.survey.takeinfo.rides', { values: { n: platform.gigsLength } })}
          </span>
          {$_('driver.survey.takeinfo.you-completed-over-the-past')}
          <span class="font-bold">
            {$_('driver.survey.takeinfo.months', { values: { n: monthsSinceMinDateToShow } })}
          </span>.
        </p>

        <MinimumAverageMaxiumumTakeChart
          minPlatformTakeString={platform.minPlatformTakeString ?? ''}
          averagePlatformTakePctString={platform.averagePlatformTakePctString}
          maxPlatformTakeString={platform.maxPlatformTakeString ?? ''}
        />
      </section>
    {/each}

    {#if showAggregate}
      <section class="mb-8 pt-6 border-t">
        <h2 class="text-center">{$_('driver.data.aggregate-take-rate-title')}</h2>
        <MinimumAverageMaxiumumTakeChart
          minPlatformTakeString={aggregate!.minPlatformTakeString ?? ''}
          averagePlatformTakePctString={aggregate!.averagePlatformTakePctString}
          maxPlatformTakeString={aggregate!.maxPlatformTakeString ?? ''}
        />
      </section>
    {/if}

    {#if unsupportedEmployers.length > 0}
      <div class="bg-warning/20 border border-warning/40 rounded p-4 my-6 text-sm">
        {$_('driver.data.unsupported-platform-note')}
      </div>
    {/if}

    <BottomDrawer orientation="vertical">
      <CsvDataDownloadButton {userId} {phoneNumberLastTwo} />
      <a class="btn btn-ghost" href="/driver/settings/org">
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
