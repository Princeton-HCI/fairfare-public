<script lang="ts">
  import Modal from '../Modal.svelte';
  import Input from '../Input.svelte';

  import { toast } from '@src/lib/toasts';
  import { userDemoPhoneNumber } from '@src/lib/stores/userDemoPhoneNumber';

  export let afterPhoneNumberSubmission: () => void;
  export let buttonText: string;
  export let buttonDisabled: boolean;

  let isSubmitting = false;

  const handlePhoneNumberSubmission = async (event: Event) => {
    const formData = new FormData(event.target as HTMLFormElement);

    const phoneNumber = formData.get('phoneNumber') as string | null;

    if (phoneNumber === null) {
      throw new Error('Phone number is required in the form submission');
    }

    // Here we save the phone number to a store so once the Argyle auth is
    // finished, we can POST to the server to send the demo text messages
    userDemoPhoneNumber.set(phoneNumber);
    // fire a toast to let the user know that the phone number was saved
    toast({ text: 'Phone number saved', type: 'success' });
    afterPhoneNumberSubmission();
  };
</script>

<Modal
  title="Enter your phone number"
  id="demo-phone-modal"
  buttonClass="btn btn-neutral w-full"
  modalClass="border-8 border-warning"
  {buttonDisabled}
>
  {#snippet dialogContent()}
    <form class="prose" onsubmit={handlePhoneNumberSubmission}>
      <p>Please enter your phone number to receive text messages for the System demo</p>
      <Input
        label="Phone Number"
        name="phoneNumber"
        pattern={`^\\d{11}$`}
        placeholder="e.g., 13033334444"
        bottomLabel="e.g., 13033334444"
        minlength={11}
        maxlength={11}
        required
      />
      <button class="btn btn-neutral w-full mt-4" disabled={isSubmitting} type="submit">
        {isSubmitting ? 'Submitting...' : 'Submit'}
      </button>
    </form>
  {/snippet}
  {#snippet buttonContent()}
    {buttonText}
  {/snippet}
</Modal>
