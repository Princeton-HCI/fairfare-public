<script lang="ts">
  import { goto } from '$app/navigation';
  import { supabase } from '@src/lib/client/db';
  import { toast } from '@src/lib/toasts';
  import { title } from '@src/lib/stores/pageinfo';
  import Spinner from '@src/lib/components/Spinner.svelte';
  import Input from '@src/lib/components/Input.svelte';

  import { _ } from 'svelte-i18n';

  title.set('Log in');

  const onPhoneAndCodeSubmit = async (event: Event) => {
    isLoading = true;

    const formData = new FormData(event.target as HTMLFormElement);
    const formPhoneNumber = formData.get('phoneNumber');
    const formSignupCode = formData.get('signupCode');

    // hit the API to verify the OTP
    const response = await fetch('/organizer/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        signupCode: formSignupCode,
        phoneNumber: formPhoneNumber
      })
    });
    isLoading = false;
    if (response.ok) {
      // show the OTP input
      showOtpInput = true;
      error = null;
    } else {
      console.log('error', response);
      const data = await response.json();
      error = data.message;
      toast({
        text: `An error occurred: ${error || response.statusText}. Please try again.`,
        type: 'error'
      });
    }
  };

  const onTokenSubmit = async (event: Event) => {
    isLoading = true;

    const formData = new FormData(event.target as HTMLFormElement);
    const formPhoneNumber = formData.get('phoneNumber');
    const formToken = formData.get('token');

    // hit the API to verify the OTP
    const response = await fetch('/organizer/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: formPhoneNumber,
        token: formToken
      })
    });
    if (response.ok) {
      const data = await response.json();
      // Sets the session here so that the credentials are available to the
      // onSuccessfulLogin callback.
      await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token
      });
      // redirect to /drivers
      await goto(`/organizer/org/${data.organizationKey}`);
    } else {
      isLoading = false;
      // get response as string
      error = await response.text();
      toast({
        text: `An error occurred: ${error}. Please try again.`,
        type: 'error'
      });
    }
  };

  let isLoading = $state(false);

  let showOtpInput = $state(false);

  let error = $state(null) as string | null;
</script>

<div class="h-screen flex items-center justify-center min-w-md w-md">
  <div class="flex flex-col justify-center items-end gap-8">
    <div class="min-w-md w-full p-8 bg-white rounded-lg shadow-md">
      <h2 class="text-2xl font-bold text-center mb-4">{$_('organizer.login.log-in')}</h2>
      <form
        onsubmit={(event) => {
          if (showOtpInput) {
            onTokenSubmit(event);
          } else {
            onPhoneAndCodeSubmit(event);
          }
        }}
      >
        <Input
          label={$_('organizer.login.signup-code')}
          name="signupCode"
          bottomLabel={$_('organizer.login.enter-your-signup-code')}
          required
          disabled={showOtpInput}
        />
        <Input
          label={$_('organizer.login.phone-number')}
          name="phoneNumber"
          bottomLabel={$_('organizer.login.format-11234567890')}
          required
        />
        {#if showOtpInput}
          <Input
            label={$_('organizer.login.one-time-passcode')}
            bottomLabel={$_('organizer.login.format-222333')}
            type="text"
            pattern="\d*"
            name="token"
            maxlength={6}
            minlength={6}
            required
          />
        {/if}
        <div class="flex justify-center h-8 items-center">
          {#if isLoading}
            <Spinner />
          {/if}
        </div>
        {#if error}
          <div
            class="border border-error text-error p-2 my-2 rounded flex justify-center"
            role="alert"
          >
            <p class="block sm:inline font-medium m-0">{error}</p>
          </div>
        {/if}

        <button type="submit" class="btn btn-neutral" disabled={isLoading}>
          {showOtpInput ? $_('organizer.login.verify') : $_('organizer.login.submit')}
        </button>
      </form>
    </div>
    <div>
      {$_('organizer.login.for-help-logging-in-please-email')}
      <a href="mailto:organization@university.edu" class="font-medium underline"
        >organization@university.edu</a
      >.
    </div>
  </div>
</div>
