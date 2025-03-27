<script lang="ts">
  import { title } from '@src/lib/stores/pageinfo';
  import Modal from '@src/lib/components/Modal.svelte';
  import { supabase } from '@src/lib/client/db';
  import { _ } from 'svelte-i18n';
  import { toast } from '@src/lib/toasts';

  import BottomDrawer from '@src/lib/components/BottomDrawer.svelte';
  import BackButton from '@src/lib/components/BackButton.svelte';
  import Input from '@src/lib/components/Input.svelte';

  let phoneNumber: string;

  type ModalStatus = 'primary' | 'awaiting-otp-entry';
  let modalStatus: ModalStatus = $state('primary');

  title.set('Opt out');

  const handleSendOtpSubmit = async (event: Event) => {
    const sendOtp = async (phoneNumber: string) => {
      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: phoneNumber })
      });
      if (!response.ok) {
        console.error('Failed to send OTP', response);
        toast({ text: $_('driver.opt-out.index.otp-sending-failed'), type: 'error' });
        return false;
      } else {
        toast({ text: $_('driver.opt-out.index.otp-code-sent'), type: 'success' });
        return true;
      }
    };

    // get form data
    event.preventDefault();

    const formData = new FormData(event.target as HTMLFormElement);
    const formPhoneNumber = formData.get('phoneNumber');

    if (typeof formPhoneNumber !== 'string' || formPhoneNumber == null) {
      console.error('Invalid phone number', formPhoneNumber);
      toast({ text: $_('driver.opt-out.index.invalid-phone-number'), type: 'error' });
      return;
    }
    // update the phoneNumber in the outer scope
    phoneNumber = formPhoneNumber as string;

    // strip non-numeric characters and check length = 10
    const phoneNumberStripped = formPhoneNumber.replace(/\D/g, '');

    if (phoneNumberStripped.length < 10) {
      console.error('Invalid phone number');
      toast({ text: $_('driver.opt-out.index.invalid-phone-number'), type: 'error' });
      return;
    }
    const sentOtpSuccessfully = await sendOtp(phoneNumberStripped);
    if (sentOtpSuccessfully) {
      modalStatus = 'awaiting-otp-entry';
    }
  };

  const handleVerifyOtpSubmit = async (event: Event) => {
    const formData = new FormData(event.target as HTMLFormElement);
    const otp = formData.get('otp');

    if (typeof otp !== 'string' || otp == null || otp.length !== 6) {
      console.error('Invalid otp');
      toast({ text: $_('driver.opt-out.index.invalid-code'), type: 'error' });
      return;
    }
    const verifyOtpResponse = await fetch('/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: phoneNumber, token: otp })
    });
    if (verifyOtpResponse.ok) {
      const data = await verifyOtpResponse.json();
      // Sets the session here so that the credentials are available to the
      // onSuccessfulLogin callback.
      await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token
      });

      const optOutResponse = await fetch('/api/driver/opt-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (optOutResponse.ok) {
        const data = await optOutResponse.json();
        const optOutSurveyId = data.optOutSurveyId;
        // redirect to exit survey with userId
        window.location.href = '/driver/opt-out/survey/' + optOutSurveyId;
      } else {
        toast({
          text: $_('driver.opt-out.index.opting-out-failed'),
          type: 'error'
        });
      }
    } else {
      toast({
        text: $_('components.auth.ConfirmIdentityWithOtpModal.incorrect-code'),
        type: 'error'
      });
    }
  };

  let modal: { closeModal: () => void };
</script>

<div class="prose">
  <h1>
    {$_('driver.opt-out.index.opt-out-of-system')}
  </h1>

  <p>
    {$_(
      'driver.opt-out.index.opting-out-of-system-will-remove-your-data-from-the-platform-and-will-prevent-researchers-from-using-it-in-the-future'
    )}
  </p>
  <p>
    {$_(
      'driver.opt-out.index.if-you-opt-out-we-will-delete-your-information-from-our-databases-and-you-will-no-longer-be-able-to-access-your-account'
    )}
  </p>
  <BottomDrawer orientation="horizontal">
    <BackButton href="/driver" moreClasses="md:hidden" />
    <div>
      <Modal
        buttonClass="btn btn-error"
        bind:this={modal}
        id="opt-out-modal"
        title={$_('driver.opt-out.index.are-you-really-sure-you-want-to-opt-out')}
      >
        {#snippet buttonContent()}
          {$_('driver.opt-out.index.opt-out')}
        {/snippet}
        {#snippet dialogContent()}
          <div class="prose">
            {$_('driver.opt-out.index.opting-out-will')}
            <ul>
              <li>{$_('driver.opt-out.index.delete-your-data-from-our-databases')}</li>
              <li>{$_('driver.opt-out.index.remove-your-ability-to-access-your-account')}</li>
              <li>
                {$_(
                  'driver.opt-out.index.prevent-researchers-from-using-your-data-for-future-research'
                )}
              </li>
            </ul>
            {#if modalStatus == 'primary'}
              {$_('driver.opt-out.index.enter-your-phone-number-to-opt-out')}
              <form
                class="flex flex-col gap-2"
                onsubmit={(event) => {
                  handleSendOtpSubmit(event);
                }}
              >
                <Input
                  label={$_('driver.opt-out.index.phone-number')}
                  bottomLabel="1 202-222-2222"
                  type="tel"
                  name="phoneNumber"
                />
                <button class="btn btn-neutral" onclick={() => modal.closeModal()} type="reset"
                  >{$_('driver.opt-out.index.no-i-changed-my-mind')}</button
                >
                <button class="btn btn-ghost" type="submit">
                  {$_('driver.opt-out.index.delete-my-data')}
                </button>
              </form>
            {/if}
            {#if modalStatus == 'awaiting-otp-entry'}
              <h3 class="text-error">
                {$_('driver.opt-out.index.deleting-your-data-is-irreversible')}
              </h3>
              <p class="text-error">
                {$_(
                  'driver.opt-out.index.enter-the-code-sent-to-your-phone-number-to-confirm-the-deletion-of-your-data'
                )}
              </p>
              <form
                class="flex flex-col gap-2"
                onsubmit={(event) => {
                  handleVerifyOtpSubmit(event);
                }}
              >
                <Input
                  label={$_('driver.opt-out.index.one-time-code')}
                  name="otp"
                  bottomLabel="123456"
                  maxlength={6}
                  minlength={6}
                />
                <button class="btn btn-neutral" onclick={() => modal.closeModal()} type="reset"
                  >{$_('driver.opt-out.index.no-i-changed-my-mind')}</button
                >
                <button class="btn btn-ghost" type="submit">
                  {$_('driver.opt-out.index.delete-my-data')}
                </button>
              </form>
            {/if}
          </div>
        {/snippet}
      </Modal>
    </div>
  </BottomDrawer>
</div>
