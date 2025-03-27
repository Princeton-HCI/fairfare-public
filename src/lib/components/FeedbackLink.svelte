<script lang="ts">
  import { _ } from 'svelte-i18n';
  import ExternalLink from './ExternalLink.svelte';
</script>

<ExternalLink href="https://organization.university.edu/#contact" size="base">
  {$_('components.useFeedback.provide-feedback-about-system')}
</ExternalLink>
