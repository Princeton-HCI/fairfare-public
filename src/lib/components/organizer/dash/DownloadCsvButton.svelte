<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { toast } from '@src/lib/toasts';
  import { exportRefreshTrigger } from '@src/lib/stores/exportNotifications';
  import { page } from '$app/state';
  import { hasCapability } from '@src/lib/rbac';
  interface Props {
    startDateString: string;
    endDateString: string;
    rateStartDateString?: string;
    rateEndDateString?: string;
    driverUserId?: string;
    driverName?: string;
    startLocation: string;
    endLocation: string;
    locationCombiner: string;
    platforms: string[];
    affiliateOrganizationKey: string;
    disabled: boolean;
    tool: 'POLICY' | 'SICK';
  }

  let {
    startDateString,
    endDateString,
    rateStartDateString,
    rateEndDateString,
    driverUserId,
    driverName,
    startLocation,
    endLocation,
    locationCombiner,
    platforms,
    affiliateOrganizationKey,
    disabled,
    tool
  }: Props = $props();

  let isRequesting = $state(false);
  let requestError = $state('');

  const isDisabled = $derived(disabled || isRequesting);

  // Exports hand back individual workers' rows, so they need the export
  // capability (researchers only have view). The endpoints check the same.
  const canExport = $derived(
    hasCapability(page.data.roles, 'org:export_driver_data', affiliateOrganizationKey)
  );

  let downloadUrl = $derived.by(() => {
    const params = new URLSearchParams({
      filterStartDate: startDateString,
      filterEndDate: endDateString,
      selectedScope: affiliateOrganizationKey,
      locationCombiner: locationCombiner
    });
    if (startLocation) {
      params.set('startLocation', startLocation);
    }
    if (endLocation) {
      params.set('endLocation', endLocation);
    }
    if (platforms.length != 0) {
      params.set('platforms', platforms.join());
    }
    if (rateStartDateString) {
      params.set('rateStartDate', rateStartDateString);
    }
    if (rateEndDateString) {
      params.set('rateEndDate', rateEndDateString);
    }
    if (driverUserId) {
      params.set('driverUserId', driverUserId);
    }
    if (driverName) {
      params.set('driverName', driverName);
    }
    return `/api/organizer/download_sick_time_csv?${params.toString()}`;
  });

  async function requestExport() {
    isRequesting = true;
    requestError = '';

    try {
      const res = await fetch('/api/organizer/request_policy_analysis_export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filterStartDate: startDateString,
          filterEndDate: endDateString,
          startLocation: startLocation || null,
          endLocation: endLocation || null,
          locationCombiner,
          platforms: platforms.length > 0 ? platforms : null,
          selectedScope: affiliateOrganizationKey
        })
      });

      const data = await res.json();

      if (res.status === 409) {
        toast({ text: $_('organizer.exports.already-in-progress'), type: 'info' });
        return;
      }

      if (!res.ok) {
        requestError = data.error || $_('organizer.policy-analysis.download.failed');
        return;
      }

      toast({ text: $_('organizer.exports.requested'), type: 'success' });
      exportRefreshTrigger.update((n) => n + 1);
    } catch {
      requestError = $_('organizer.policy-analysis.download.failed');
    } finally {
      isRequesting = false;
    }
  }

  function extractFilename(contentDisposition: string | null, fallbackName: string): string {
    if (!contentDisposition) return fallbackName;

    const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1]);

    const quotedMatch = contentDisposition.match(/filename="([^"]+)"/i);
    if (quotedMatch?.[1]) return quotedMatch[1];

    const plainMatch = contentDisposition.match(/filename=([^;]+)/i);
    if (plainMatch?.[1]) return plainMatch[1].trim();

    return fallbackName;
  }

  async function downloadSickCsv() {
    if (isDisabled || tool !== 'SICK') return;

    isRequesting = true;
    requestError = '';

    try {
      const res = await fetch(downloadUrl);

      if (!res.ok) {
        requestError = $_('organizer.policy-analysis.download.failed');
        return;
      }

      const blob = await res.blob();
      const fallbackName = `sick_time_${new Date().toISOString().slice(0, 10)}.csv`;
      const fileName = extractFilename(res.headers.get('content-disposition'), fallbackName);

      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      requestError = $_('organizer.policy-analysis.download.failed');
    } finally {
      isRequesting = false;
    }
  }
</script>

{#if canExport}
  <div class="relative">
    {#if tool === 'POLICY'}
      <button
        class="btn btn-primary gap-1.5"
        class:btn-disabled={isDisabled}
        disabled={isDisabled}
        onclick={requestExport}
      >
        {#if isRequesting}
          <span class="loading loading-spinner loading-sm"></span>
        {:else}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fill-rule="evenodd"
              d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
              clip-rule="evenodd"
            />
          </svg>
        {/if}
        {#if isRequesting}
          {$_('organizer.policy-analysis.download.requesting')}
        {:else}
          {$_('organizer.policy-analysis.download.request-button')}
        {/if}
      </button>
    {:else}
      <button
        class="btn btn-primary"
        class:btn-disabled={isDisabled}
        disabled={isDisabled}
        onclick={downloadSickCsv}
      >
        {#if isRequesting}
          <span class="loading loading-spinner loading-sm mr-2"></span>
          {$_('organizer.policy-analysis.download.downloading')}
        {:else}
          {$_('organizer.policy-analysis.download.download-button')}
        {/if}
      </button>
    {/if}

    {#if requestError}
      <p class="absolute top-full mt-1 text-sm text-error whitespace-nowrap">{requestError}</p>
    {/if}
  </div>
{/if}
