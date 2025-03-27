<script lang="ts">
  /**
   * This is an interstitial modal that asks the user to confirm their
   * identity with an OTP before executing a sensitive action.
   *
   * The sensitive action is passed in as a callback, onSuccessfulLogin.
   * TODO: if the component doesn't get a phone number, it asks the user
   *   for their phone number.
   *
   */
  import { supabase } from '@src/lib/client/db';
  import { _ } from 'svelte-i18n';
  import Modal from '../Modal.svelte';
  import { toast } from '@src/lib/toasts';
  import Input from '../Input.svelte';

  interface Props {
    userId: string;
    onSuccessfulLogin?: () => void;
    phoneNumberLastTwo: string;
    children: import('svelte').Snippet;
  }

  let { userId, onSuccessfulLogin = () => {}, phoneNumberLastTwo, children }: Props = $props();

  if (!userId) {
    throw new Error('userId is required');
  }

  const sendOtp = () => {
    fetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    });
  };

  const onOpen = () => {
    // hit the API to sent the OTP
    sendOtp();
  };

  const handleSubmit = async (event: Event) => {
    const formData = new FormData(event.target as HTMLFormElement);
    const otp = formData.get('otp');

    // hit the API to verify the OTP
    const response = await fetch('/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, token: otp })
    });
    if (response.ok) {
      const data = await response.json();
      // Sets the session here so that the credentials are available to the
      // onSuccessfulLogin callback.
      await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token
      });
      onSuccessfulLogin();
      modal.closeModal();
    } else {
      toast({
        text: $_('components.auth.ConfirmIdentityWithOtpModal.incorrect-code'),
        type: 'error'
      });
    }
  };

  let showResendCodeLink = $state(false);
  let modal: { closeModal: () => void };

  // after 10 seconds, show the resend code link
  setTimeout(() => {
    showResendCodeLink = true;
  }, 10_000);
</script>

<Modal
  bind:this={modal}
  buttonClass="btn btn-neutral w-full"
  {onOpen}
  onClose={() => {
    showResendCodeLink = false;
  }}
  id="confirm-identity-with-otp-modal"
  title={$_('components.auth.ConfirmIdentityWithOtpModal.verify-your-identity')}
>
  {#snippet buttonContent()}
    {@render children()}
  {/snippet}
  {#snippet dialogContent()}
    <div class="container flex flex-col items-center gap-2">
      <p>
        {$_(
          'components.auth.ConfirmIdentityWithOtpModal.in-order-to-download-this-data-we-need-to-confirm-your-identity'
        )}
      </p>
      <div class="flex flex-col text-center">
        <p>
          {$_(
            'components.auth.ConfirmIdentityWithOtpModal.weve-sent-a-message-to-xxx-xxx-xx'
          )}{phoneNumberLastTwo}.
        </p>
        <a
          class="btn-link normal-case text-neutral"
          href="https://organization.university.edu/#contact"
          target="_blank"
          rel="noopener noreferrer"
        >
          {$_('components.auth.ConfirmIdentityWithOtpModal.not-your-phone-number')}
        </a>
      </div>
      <form
        onsubmit={(event) => {
          handleSubmit(event);
        }}
        class="flex flex-col gap-2 pt-4 w-full"
      >
        <Input
          type="number"
          max={999999}
          min={0}
          maxlength={6}
          label={$_('components.auth.ConfirmIdentityWithOtpModal.enter-code')}
          name="otp"
        />
        <button type="submit" class="btn btn-neutral mt-4">
          {$_('components.auth.ConfirmIdentityWithOtpModal.submit')}
        </button>
        {#if showResendCodeLink}
          <button
            type="button"
            class="btn btn-ghost"
            onclick={() => {
              sendOtp();
              toast({
                text: $_('components.auth.ConfirmIdentityWithOtpModal.code-resent'),
                type: 'success'
              });
              showResendCodeLink = false;
              setTimeout(() => {
                showResendCodeLink = true;
              }, 10000);
            }}
          >
            {$_('components.auth.ConfirmIdentityWithOtpModal.resend-code')}
          </button>
        {/if}
      </form>
    </div>
  {/snippet}
</Modal>
