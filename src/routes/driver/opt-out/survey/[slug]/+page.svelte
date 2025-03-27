<script lang="ts">
  import { enhance } from '$app/forms';
  import BottomDrawer from '@src/lib/components/BottomDrawer.svelte';
  import { _ } from 'svelte-i18n';

  let { data } = $props();
  const { slug } = data;

  let form = $state({
    survey_left_reason: '',
    survey_comments: ''
  });
</script>

<div class="prose">
  <form method="POST" class="w-full" use:enhance>
    <h1>
      {$_('driver.opt-out.survey.thank-you-for-participating-in-system')}
    </h1>
    <p class="font-bold">
      {$_(
        'driver.opt-out.survey.you-have-successfully-opted-out-and-your-data-has-been-removed-from-our-system'
      )}
    </p>
    <p>
      {$_(
        'driver.opt-out.survey.the-following-questions-are-optional-but-your-responses-help-us-develop-a-better-data-tool'
      )}
    </p>

    <h2>
      {$_('driver.opt-out.survey.leaving-system')}
    </h2>
    <label class="label-text" for="survey_left_reason">
      {$_('driver.opt-out.survey.why-are-you-leaving-system')}
    </label>
    <textarea
      rows="3"
      name="survey_left_reason"
      id="survey_left_reason"
      class="textarea w-full"
      placeholder={$_(
        'driver.opt-out.survey.number-of-drivers-rider-pickup-location-i-dont-know-etc'
      )}
      bind:value={form.survey_left_reason}
    ></textarea>
    <label class="label-text" for="survey_comments">
      {$_('driver.opt-out.survey.do-you-have-any-other-comments')}
    </label>
    <textarea
      rows="3"
      name="survey_comments"
      id="survey_comments"
      class="textarea w-full"
      placeholder={$_('driver.opt-out.survey.i-left-system-because')}
      bind:value={form.survey_comments}
    ></textarea>
    <input type="hidden" name="id" value={slug} />
    <BottomDrawer>
      <!-- placeholder to push button to the right -->
      <div></div>
      <button class="btn btn-neutral" disabled={!form.survey_left_reason && !form.survey_comments}>
        {$_('driver.opt-out.survey.submit')}
      </button>
    </BottomDrawer>
  </form>
</div>
