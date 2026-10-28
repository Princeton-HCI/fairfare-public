<script lang="ts">
  import { _ } from 'svelte-i18n';
  import Spinner from '@src/lib/components/Spinner.svelte';
  import { verifyDriverSignupCode } from '@src/lib/client/driverOrgSharingApi';
  import { toast } from '@src/lib/toasts';

  interface Props {
    orgKey: string;
    onVerified: (code: string) => void;
    children?: import('svelte').Snippet;
  }

  let { orgKey, onVerified, children }: Props = $props();

  let code = $state('');
  let isVerifying = $state(false);
  let isVerified = $state(false);
  let errorMessage = $state<string | null>(null);

  const handleSubmit = async (event: SubmitEvent) => {
    event.preventDefault();
    if (!code.trim()) return;

    isVerifying = true;
    errorMessage = null;

    try {
      await verifyDriverSignupCode(orgKey, code.trim());
      isVerified = true;
      onVerified(code.trim());
      toast({ text: $_('driver.signup-code-gate.verified'), type: 'success' });
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : $_('driver.signup-code-gate.error');
    } finally {
      isVerifying = false;
    }
  };
</script>

{#if isVerified}
  {@render children?.()}
{:else}
  <form onsubmit={handleSubmit} class="prose mx-auto max-w-md">
    <h2 class="mt-0">{$_('driver.signup-code-gate.title')}</h2>
    <p class="text-sm">{$_('driver.signup-code-gate.description')}</p>

    <label class="form-control w-full mt-4">
      <div class="label">
        <span class="label-text">{$_('driver.signup-code-gate.label')}</span>
      </div>
      <input
        type="text"
        name="signupCode"
        autocomplete="one-time-code"
        inputmode="text"
        placeholder={$_('driver.signup-code-gate.placeholder')}
        class="input input-bordered w-full"
        bind:value={code}
        disabled={isVerifying}
        required
      />
    </label>

    {#if errorMessage}
      <p class="text-sm text-error mt-2" role="alert">{errorMessage}</p>
    {/if}

    <div class="mt-6 flex justify-end">
      <button type="submit" class="btn btn-neutral" disabled={isVerifying || !code.trim()}>
        {#if isVerifying}<Spinner />{/if}
        {$_('driver.signup-code-gate.continue')}
      </button>
    </div>
  </form>
{/if}
