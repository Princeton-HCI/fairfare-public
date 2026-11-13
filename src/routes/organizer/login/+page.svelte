<script lang="ts">
  import { goto } from '$app/navigation';
  import { supabase } from '@src/lib/client/db';
  import { toast } from '@src/lib/toasts';
  import { title } from '@src/lib/stores/pageinfo';
  import Spinner from '@src/lib/components/Spinner.svelte';
  import Input from '@src/lib/components/Input.svelte';
  import { _ } from 'svelte-i18n';
  import PhoneNumberInput from '@src/lib/components/PhoneNumberInput.svelte';
  import { PUB_SUPPORT_EMAIL } from '$env/static/public';
  import { isDemoMode } from '@src/lib/utils';
  import { DEMO_OTP } from '$lib/demo/constants';

  title.set('Log in');

  const onPhoneAndCodeSubmit = async (event: Event) => {
    isLoading = true;

    const formData = new FormData(event.target as HTMLFormElement);
    const formSignupCode = formData.get('signupCode');

    // Store the signup code for use in OTP verification
    signupCode = formSignupCode as string;

    // hit the API to verify the OTP
    const response = await fetch('/organizer/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        signupCode: formSignupCode,
        phoneNumber: phoneNumber
      })
    });
    isLoading = false;
    if (response.ok) {
      // show the OTP input
      showOtpInput = true;
      error = null;
    } else {
      console.error('error', response);
      const data = await response.json().catch(() => ({}));
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
    const formToken = formData.get('token');

    // hit the API to verify the OTP
    const response = await fetch('/organizer/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // remove the + prefix
        phone: phoneNumber,
        token: formToken,
        signupCode: signupCode
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
      // Refresh layout data so `page.data.roles` reflects the new session on the
      // first render (nav items and read-only labels depend on it).
      // `/organizer/org/` on its own is not a route, so fall back to the key the
      // response carries rather than sending the user to a 404.
      const destination =
        data.redirectTo ??
        (data.organizationKey ? `/organizer/org/${data.organizationKey}` : '/organizer/login');
      await goto(destination, {
        invalidateAll: true
      });
    } else {
      isLoading = false;
      const data = await response.json().catch(() => ({}));
      error = data.message;
      toast({
        text: `An error occurred: ${error || response.statusText}. Please try again.`,
        type: 'error'
      });
    }
  };

  let isLoading = $state(false);

  let phoneNumber = $state('');
  let showOtpInput = $state(false);
  let signupCode = $state('');
  let otpValue = $state(isDemoMode ? DEMO_OTP : '');

  let error = $state(null) as string | null;

  // Back to the first step, e.g. when no SMS arrived.
  const startOver = () => {
    showOtpInput = false;
    otpValue = isDemoMode ? DEMO_OTP : '';
    error = null;
  };
</script>

<div class="h-screen flex items-center justify-center min-w-md w-md">
  <div class="flex flex-col justify-center items-end gap-8">
    <div class="min-w-md w-full p-8 bg-white rounded-lg shadow-md">
      <h2 class="text-2xl font-bold text-center mb-4">{$_('organizer.login.log-in')}</h2>
      <form
        onsubmit={(event) => {
          // Both steps submit over fetch. Without this the browser also runs its
          // own GET submit, which rewrites the URL to
          // ?signupCode=…&phoneNumber=… — putting the organization's signup code
          // into history, logs and any outbound referrer.
          event.preventDefault();
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
          bottomLabel={isDemoMode
            ? $_('demo.organizer.signup_codes')
            : $_('organizer.login.enter-your-signup-code')}
          required
          disabled={showOtpInput}
        />
        <PhoneNumberInput {showOtpInput} bind:phoneNumber />
        {#if showOtpInput}
          <Input
            label={$_('organizer.login.one-time-passcode')}
            bottomLabel={isDemoMode
              ? $_('demo.organizer.otp_hint')
              : $_('organizer.login.format-222333')}
            type="text"
            pattern="\d*"
            name="token"
            maxlength={6}
            minlength={6}
            required
            bind:value={otpValue}
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
        {#if showOtpInput}
          <button type="button" class="btn btn-link btn-sm mt-2" onclick={startOver}>
            {$_('organizer.login.start-over')}
          </button>
        {/if}
      </form>
    </div>
    <div>
      {$_('organizer.login.for-help-logging-in-please-email')}
      <a href="mailto:{PUB_SUPPORT_EMAIL}" class="font-medium underline">{PUB_SUPPORT_EMAIL}</a>.
    </div>
  </div>
</div>
