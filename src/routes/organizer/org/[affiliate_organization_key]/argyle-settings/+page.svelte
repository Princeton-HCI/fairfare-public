<script lang="ts">
  import QRCode from 'qrcode';
  import { invalidateAll } from '$app/navigation';
  import { page } from '$app/state';
  import { hasCapability } from '@src/lib/rbac';
  import { title } from '@src/lib/stores/pageinfo';
  import { toast } from '@src/lib/toasts';
  import ConfirmDialog from '@src/lib/components/ConfirmDialog.svelte';
  import DriverTable from '@src/lib/components/organizer/dash/DriverTable.svelte';
  import Spinner from '@src/lib/components/Spinner.svelte';
  import {
    deaffiliateOrganizerDriver,
    disconnectOrganizerArgyleCredentials,
    saveOrganizerArgyleCredentials,
    updateOrganizerArgyleControls
  } from '@src/lib/client/organizerArgyleApi';

  let { data } = $props();

  title.set('Organizer | Argyle Settings');

  const organization = $derived(data.organization);
  const requiresSignupCode = $derived(data.requiresSignupCode);
  const driverSignupCodeFromServer = $derived(data.driverSignupCode);
  const currentArgyleAccountCount = $derived(data.currentArgyleAccountCount);
  const argyleConfig = $derived(data.argyleConfig);
  const sharingDrivers = $derived(data.sharingDrivers);

  const signupLink = $derived(`${page.url.origin}/driver/landing?org=${organization.key}`);
  let qrDataUrl = $state<string | null>(null);
  let linkCopied = $state(false);

  $effect(() => {
    QRCode.toDataURL(signupLink, { width: 240, margin: 0 })
      .then((url) => (qrDataUrl = url))
      .catch((error) => {
        console.error('Could not render QR locally:', error);
        qrDataUrl = null;
      });
  });

  const copySignupLink = async () => {
    await navigator.clipboard.writeText(signupLink);
    linkCopied = true;
    toast({ text: 'Signup link copied to clipboard.', type: 'success' });
    setTimeout(() => (linkCopied = false), 2000);
  };

  const downloadSignupQr = async () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `${organization.key}-driver-signup-qr.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    toast({ text: 'Driver signup QR code downloaded.', type: 'success' });
  };

  let apiKeyId = $state('');
  let apiKeySecret = $state('');
  let flowId = $state('');
  let isSavingCredentials = $state(false);

  $effect(() => {
    apiKeyId = argyleConfig?.apiKeyId ?? '';
    flowId = argyleConfig?.flowId ?? '';
  });

  const isConnected = $derived(argyleConfig?.hasCredentials && argyleConfig?.isActive);

  const saveCredentials = async (event: SubmitEvent) => {
    event.preventDefault();
    isSavingCredentials = true;
    try {
      await saveOrganizerArgyleCredentials({
        organizationKey: organization.key,
        apiKeyId,
        apiKeySecret,
        flowId: flowId || null
      });
      toast({ text: 'Argyle credentials saved.', type: 'success' });
      apiKeySecret = '';
      await invalidateAll();
    } catch (error) {
      toast({
        text: error instanceof Error ? error.message : 'Could not save credentials.',
        type: 'error'
      });
    } finally {
      isSavingCredentials = false;
    }
  };

  const disconnect = async () => {
    try {
      await disconnectOrganizerArgyleCredentials(organization.key);
      toast({ text: 'Argyle disconnected.', type: 'success' });
      await invalidateAll();
    } catch (error) {
      toast({
        text: error instanceof Error ? error.message : 'Could not disconnect.',
        type: 'error'
      });
    }
  };

  let driverSignupCode = $state('');
  let maxArgyleAccountsInput = $state<number | ''>('');
  let isSavingControls = $state(false);

  $effect(() => {
    driverSignupCode = driverSignupCodeFromServer;
    maxArgyleAccountsInput = argyleConfig?.maxArgyleAccounts ?? '';
  });

  const saveControls = async (event: SubmitEvent) => {
    event.preventDefault();
    isSavingControls = true;
    try {
      const rawMax = `${maxArgyleAccountsInput ?? ''}`.trim();
      const parsedMax = rawMax ? parseInt(rawMax, 10) : null;
      if (parsedMax !== null && (Number.isNaN(parsedMax) || parsedMax <= 0)) {
        throw new Error('Max Argyle accounts must be a positive integer or empty.');
      }

      const signupCodePayload = driverSignupCode.trim() || null;

      await updateOrganizerArgyleControls({
        organizationKey: organization.key,
        signupCodePlaintext: signupCodePayload,
        maxArgyleAccounts: parsedMax
      });

      toast({ text: 'Settings saved.', type: 'success' });
      await invalidateAll();
    } catch (error) {
      toast({
        text: error instanceof Error ? error.message : 'Could not save settings.',
        type: 'error'
      });
    } finally {
      isSavingControls = false;
    }
  };

  let deaffiliatingUserId = $state<string | null>(null);

  const handleDisableSync = async (driverUserId: string) => {
    deaffiliatingUserId = driverUserId;
    try {
      await deaffiliateOrganizerDriver({
        organizationKey: organization.key,
        driverUserId
      });
      toast({ text: 'Argyle sync disabled.', type: 'success' });
      await invalidateAll();
    } catch (error) {
      toast({
        text: error instanceof Error ? error.message : 'Could not disable Argyle sync.',
        type: 'error'
      });
    } finally {
      deaffiliatingUserId = null;
    }
  };

  const sharingDriverCount = $derived(sharingDrivers?.length ?? 0);
  const billedDriverCount = $derived(
    sharingDrivers?.filter((driver) => driver.is_billed_to_organization).length ?? 0
  );
  const capacityLabel = $derived(
    argyleConfig?.maxArgyleAccounts
      ? `${currentArgyleAccountCount} / ${argyleConfig.maxArgyleAccounts}`
      : `${currentArgyleAccountCount} (no cap)`
  );
</script>

<div class="organizer-dash">
  <h1 class="font-serif text-2xl font-medium text-base-content">Argyle settings</h1>
  <p class="text-sm text-base-content/50 mt-1 mb-6">
    Manage credentials, signup rules, capacity limits, and driver access for
    <strong>{organization.name}</strong>.
  </p>

  <!-- Summary cards -->
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
    <div
      class="bg-white/80 rounded-lg p-5 border-l-[3px] {isConnected
        ? 'border-primary'
        : 'border-base-content/20'}"
    >
      <p class="text-sm text-base-content/50">Connection</p>
      <p class="text-xl font-bold mt-1">
        {#if isConnected}Connected{:else if argyleConfig}Inactive{:else}Not configured{/if}
      </p>
    </div>
    <div class="bg-white/80 rounded-lg p-5 border-l-[3px] border-accent">
      <p class="text-sm text-base-content/50">Argyle accounts</p>
      <p class="text-xl font-bold mt-1">{capacityLabel}</p>
    </div>
    <div class="bg-white/80 rounded-lg p-5 border-l-[3px] border-[#A052A6]">
      <p class="text-sm text-base-content/50">Primary drivers</p>
      <p class="text-xl font-bold mt-1">{sharingDriverCount}</p>
    </div>
    <div class="bg-white/80 rounded-lg p-5 border-l-[3px] border-secondary">
      <p class="text-sm text-base-content/50">Billed drivers</p>
      <p class="text-xl font-bold mt-1">{billedDriverCount}</p>
    </div>
  </div>

  <!-- Signup link + QR -->
  <section class="mt-8 bg-white rounded-lg p-5 shadow-sm">
    <h2 class="text-lg font-semibold">Driver signup link</h2>
    <p class="text-sm text-base-content/60 mt-1 mb-4">
      Share this link or QR with drivers you want to onboard to this organization.
    </p>
    <div class="flex flex-col sm:flex-row gap-4 items-start">
      <div class="flex-1 w-full">
        <div class="flex gap-2 items-center">
          <input
            type="text"
            readonly
            value={signupLink}
            class="input input-bordered w-full text-sm"
          />
          <button class="btn btn-sm btn-neutral" onclick={copySignupLink} type="button">
            {linkCopied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        {#if requiresSignupCode}
          <p class="text-xs text-base-content/50 mt-2">
            Drivers will be prompted for the signup code you've set below.
          </p>
        {/if}
      </div>
      <div class="flex flex-col items-center gap-2">
        {#if qrDataUrl}
          <img src={qrDataUrl} alt="Driver signup QR" width="120" height="120" />
          <button class="btn btn-xs btn-ghost" onclick={downloadSignupQr} type="button">
            Download
          </button>
        {:else}
          <Spinner />
        {/if}
      </div>
    </div>
  </section>

  <!-- Credentials form -->
  <section class="mt-6 bg-white rounded-lg p-5 shadow-sm">
    <h2 class="text-lg font-semibold">Argyle credentials</h2>
    <p class="text-sm text-base-content/60 mt-1 mb-4">
      {#if isConnected}
        Your Argyle credentials are encrypted at rest and never returned by the server. Disconnect
        to stop new drivers from connecting.
      {:else}
        Connect your organization's own Argyle account. The secret is encrypted before storage and
        is never returned by the server.
      {/if}
    </p>

    {#if isConnected}
      <div
        class="rounded-md border border-base-content/10 bg-base-200/40 divide-y divide-base-content/10"
      >
        <div class="flex items-center justify-between px-4 py-3">
          <span class="text-xs uppercase tracking-wide text-base-content/50">API key ID</span>
          <code class="text-sm font-mono text-base-content/80"
            >{argyleConfig?.apiKeyId
              ? `${argyleConfig.apiKeyId.slice(0, 8)}…${argyleConfig.apiKeyId.slice(-4)}`
              : '—'}</code
          >
        </div>
        <div class="flex items-center justify-between px-4 py-3">
          <span class="text-xs uppercase tracking-wide text-base-content/50">Flow ID</span>
          <code class="text-sm font-mono text-base-content/80"
            >{argyleConfig?.flowId || 'Default'}</code
          >
        </div>
        <div class="flex items-center justify-between px-4 py-3">
          <span class="text-xs uppercase tracking-wide text-base-content/50">Webhook</span>
          <span class="text-sm">
            {#if argyleConfig?.hasWebhookSubscription}
              <span class="inline-flex items-center gap-1.5 text-success">
                <span class="w-1.5 h-1.5 rounded-full bg-success"></span> Subscribed
              </span>
            {:else}
              <span class="inline-flex items-center gap-1.5 text-base-content/50">
                <span class="w-1.5 h-1.5 rounded-full bg-base-content/30"></span> Not subscribed
              </span>
            {/if}
          </span>
        </div>
      </div>
      <div class="mt-4 flex justify-end">
        <ConfirmDialog
          id="disconnect-argyle-credentials"
          title="Disconnect Argyle?"
          message="This will delete the per-org webhook subscription and stop new drivers from connecting. You can reconnect at any time by entering credentials again."
          confirmLabel="Disconnect"
          destructive
          onConfirm={disconnect}
          buttonClass="btn btn-sm btn-ghost text-error hover:bg-error/10"
        >
          {#snippet trigger()}
            Disconnect
          {/snippet}
        </ConfirmDialog>
      </div>
    {:else}
      <form onsubmit={saveCredentials} class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label class="form-control">
          <div class="label"><span class="label-text">API key ID</span></div>
          <input
            type="text"
            class="input input-bordered"
            bind:value={apiKeyId}
            placeholder="00000000-0000-0000-0000-000000000000"
            required
          />
        </label>
        <label class="form-control">
          <div class="label"><span class="label-text">API secret</span></div>
          <input
            type="password"
            class="input input-bordered"
            bind:value={apiKeySecret}
            placeholder="Argyle API secret"
            autocomplete="off"
            required
          />
        </label>
        <label class="form-control">
          <div class="label">
            <span class="label-text">Flow ID</span>
            <span class="label-text-alt text-base-content/50">optional</span>
          </div>
          <input
            type="text"
            class="input input-bordered"
            bind:value={flowId}
            placeholder="QM3BSPT2"
          />
        </label>

        <div class="sm:col-span-2">
          <button type="submit" class="btn btn-neutral" disabled={isSavingCredentials}>
            {#if isSavingCredentials}<Spinner />{/if}
            Connect Argyle
          </button>
        </div>
      </form>
    {/if}
  </section>

  <!-- Controls form -->
  <section class="mt-6 bg-white rounded-lg p-5 shadow-sm">
    <h2 class="text-lg font-semibold">Driver controls</h2>
    <p class="text-sm text-base-content/60 mt-1 mb-4">
      Optional gate code drivers must enter, and a cap on how many Argyle accounts your org can bill
      at once.
    </p>

    <form onsubmit={saveControls} class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div class="form-control">
        <div class="label">
          <span class="label-text">Driver signup code</span>
          {#if requiresSignupCode}
            <span class="label-text-alt text-base-content/50">configured</span>
          {:else}
            <span class="label-text-alt text-base-content/50">not configured</span>
          {/if}
        </div>
        <input
          type="text"
          class="input input-bordered w-full"
          bind:value={driverSignupCode}
          placeholder="e.g. spring-2026"
          autocomplete="off"
          spellcheck="false"
        />
        <p class="text-xs text-base-content/40 mt-1">
          Drivers must enter this code before joining. Clear the field and save to remove the gate.
        </p>
      </div>

      <label class="form-control">
        <div class="label">
          <span class="label-text">Max Argyle accounts</span>
          <span class="label-text-alt text-base-content/50">empty = no cap</span>
        </div>
        <input
          type="number"
          min="1"
          class="input input-bordered"
          bind:value={maxArgyleAccountsInput}
          placeholder="e.g. 250"
        />
      </label>

      <div class="sm:col-span-2">
        <button type="submit" class="btn btn-neutral" disabled={isSavingControls}>
          {#if isSavingControls}<Spinner />{/if}
          Save settings
        </button>
      </div>
    </form>
  </section>

  <!-- Drivers whose primary organization is this one -->
  <section class="mt-6">
    <p class="text-sm text-base-content/60 mb-3">
      Drivers who chose {organization.name} as their primary organization. Disabling sync disconnects
      their Argyle accounts, which stops new data and Argyle billing for them.
    </p>
    <DriverTable
      profiles={sharingDrivers}
      desc="Drivers with {organization.name} as their primary organization"
      showDeaffiliateButton={hasCapability(
        page.data.roles,
        'org:deaffiliate_driver',
        organization.key
      )}
      onDeaffiliate={handleDisableSync}
      {deaffiliatingUserId}
      showStatusFilter
      deaffiliateLabel="Disable sync"
      deaffiliatingLabel="Disabling..."
      deaffiliateConfirmTitle="Disable Argyle sync?"
      deaffiliateConfirmMessage={(driverName) =>
        `Disconnect ${driverName}'s Argyle accounts? Their data will stop syncing, and they will stop sharing data with ${organization.name} and any other organization they share with. They can sign up again later.`}
      emptyMessage="No drivers have chosen {organization.name} as their primary organization yet."
    />
  </section>
</div>
