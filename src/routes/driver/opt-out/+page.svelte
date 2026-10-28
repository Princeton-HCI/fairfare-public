<script lang="ts">
  import { title } from '@src/lib/stores/pageinfo';
  import Modal from '@src/lib/components/Modal.svelte';
  import { supabase } from '@src/lib/client/db';
  import { _ } from 'svelte-i18n';
  import { toast } from '@src/lib/toasts';
  import { dataSharingConsents } from '@src/lib/stores/dataSharingConsents';

  import BottomDrawer from '@src/lib/components/BottomDrawer.svelte';
  import BackButton from '@src/lib/components/BackButton.svelte';
  import Input from '@src/lib/components/Input.svelte';

  import PhoneNumberInput from '@src/lib/components/PhoneNumberInput.svelte';
  import { isDemoMode } from '@src/lib/utils';
  import { DEMO_OTP } from '$lib/demo/constants';

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

    if (phoneNumber.length < 10) {
      console.error('Invalid phone number');
      toast({ text: $_('driver.opt-out.index.invalid-phone-number'), type: 'error' });
      return;
    }
    // In demo mode, skip sending OTP since we use a fixed code
    if (isDemoMode) {
      modalStatus = 'awaiting-otp-entry';
      return;
    }

    const sentOtpSuccessfully = await sendOtp(phoneNumber);
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

        await supabase.auth.signOut();
        window.sessionStorage.removeItem('affiliations');
        window.sessionStorage.removeItem('dataSharingConsents');
        window.sessionStorage.removeItem('argyleAccounts');

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
  let phoneNumber = $state('');
  let otpValue = $state(isDemoMode ? DEMO_OTP : '');

  // Load user's data sharing consents on page load
  dataSharingConsents.getSelectedDataSharingConsentsFromDatabase();

  // Create a derived value for the organization names
  let consentedOrganizations = $derived(
    $dataSharingConsents.selected.map((org) => org.name).join(', ')
  );
</script>

<div class="prose">
  <h1>{$_('driver.settings.delete-all-my-data-from-system')}</h1>

  <p>{$_('driver.opt-out.deleting-your-data-from-system-will')}</p>
  <ul>
    <li>
      {$_('driver.opt-out.prevent-organizations-from-accessing-your-data', {
        values: { consentedOrganizations: consentedOrganizations || 'organizations' }
      })}
    </li>
    <li>{$_('driver.opt-out.prevent-researchers-from-using-your-data-in-the-future')}</li>
    <li>{$_('driver.opt-out.delete-your-information-from-our-databases')}</li>
    <li>{$_('driver.opt-out.make-it-impossible-to-further-access-your-account')}</li>
  </ul>
  <BottomDrawer orientation="horizontal">
    <BackButton href="/driver" moreClasses="md:hidden" />
    <div>
      <Modal
        buttonClass="btn btn-error"
        bind:this={modal}
        id="opt-out-modal"
        title={$_(
          'driver.settings.are-you-really-sure-you-want-to-delete-all-your-data-from-system'
        )}
      >
        {#snippet buttonContent()}
          {$_('driver.opt-out.index.delete-my-data')}
        {/snippet}
        {#snippet dialogContent()}
          <div class="prose">
            <p>{$_('driver.opt-out.deleting-your-data-from-system-will')}</p>
            <ul>
              <li>
                {$_('driver.opt-out.prevent-organizations-from-accessing-your-data', {
                  values: { consentedOrganizations: consentedOrganizations || 'organizations' }
                })}
              </li>
              <li>{$_('driver.opt-out.prevent-researchers-from-using-your-data-in-the-future')}</li>
              <li>{$_('driver.opt-out.delete-your-information-from-our-databases')}</li>
              <li>{$_('driver.opt-out.make-it-impossible-to-further-access-your-account')}</li>
            </ul>
            {#if modalStatus == 'primary'}
              {$_('driver.opt-out.enter-your-phone-number-to-delete-your-data')}
              <form
                class="flex flex-col gap-4"
                onsubmit={(event) => {
                  handleSendOtpSubmit(event);
                }}
              >
                <PhoneNumberInput bind:phoneNumber />
                <button
                  class="btn btn-neutral w-full"
                  onclick={() => modal.closeModal()}
                  type="reset">{$_('driver.opt-out.no-i-changed-my-mind')}</button
                >
                <button class="btn btn-error w-full" type="submit">
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
                  bind:value={otpValue}
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
