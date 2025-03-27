<script lang="ts">
  import { _ } from 'svelte-i18n';
  import LanguageSelector from './LanguageSelector.svelte';
  import FeedbackLink from '../FeedbackLink.svelte';
</script>

<footer class="mt-12">
  <div class="px-4 md:px-6 flex flex-col gap-2 pb-6">
    <div class="flex items-center gap-2">
      <img src="https://placehold.co/32" alt="The System logo." class="rounded-lg" />
      <span class="font-semibold text-2xl">Sample System</span>
    </div>
    <span class="text-xs text-neutral-500">{$_('nav.footer.a-organization-project')}</span>
  </div>
  <div class="w-svw bg-primary pt-4 pb-32 flex flex-col items-center justify-center">
    <nav>
      <div class="flex flex-col gap-1 py-4 items-center justify-center">
        <a href="/driver/about" class="btn-link normal-case text-neutral">
          {$_('driver.landing.learn-more-about-system')}</a
        >
        <FeedbackLink />
        <a href="/driver/opt-out" class="link text-neutral">
          {$_('driver.opt-out.index.opt-out-of-system')}
        </a>
        <a class="btn-link normal-case underline text-neutral" href="/about/privacy"
          >{$_('nav.footer.privacy-policy')}</a
        >
      </div>
    </nav>
    <LanguageSelector />
  </div>
</footer>
