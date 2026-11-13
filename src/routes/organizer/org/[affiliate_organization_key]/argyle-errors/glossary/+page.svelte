<script lang="ts">
  import { page } from '$app/state';
  import ExternalLink from '@src/lib/components/ExternalLink.svelte';
  import {
    ARGYLE_CONNECTION_ERRORS,
    ARGYLE_ERROR_CATEGORIES,
    ARGYLE_ERRORS_DOCS_URL
  } from '@src/lib/organizer/argyleConnectionErrors';
  import { title } from '@src/lib/stores/pageinfo';

  title.set('Organizer | Argyle Error Glossary');

  const accountErrorsHref = $derived(
    `/organizer/org/${page.params.affiliate_organization_key}/argyle-errors`
  );

  // The entry linked from the Account Errors page (#error_code), highlighted below.
  const selectedCode = $derived(decodeURIComponent(page.url.hash.slice(1)));

  const sections = ARGYLE_ERROR_CATEGORIES.map((category) => ({
    ...category,
    errors: ARGYLE_CONNECTION_ERRORS.filter((error) => error.category === category.key)
  }));
</script>

<div>
  <a href={accountErrorsHref} class="link text-sm text-base-content/60">← Account errors</a>
  <h1 class="font-serif text-2xl font-medium text-base-content mt-2">Argyle error glossary</h1>
  <p class="text-sm text-base-content/50 mt-1 mb-4">
    What each Argyle connection error means and how to help the driver fix it.
  </p>

  <nav aria-label="Error types" class="flex flex-wrap gap-2 mb-6">
    {#each sections as section (section.key)}
      <a href="#{section.key}" class="badge badge-ghost hover:badge-neutral">{section.label}</a>
    {/each}
  </nav>

  <div class="space-y-6">
    {#each sections as section (section.key)}
      <section id={section.key} class="scroll-mt-6 w-full bg-white rounded-lg shadow-sm">
        <h2 class="px-5 pt-5 pb-3 text-lg font-semibold text-base-content">{section.label}</h2>
        <dl class="divide-y divide-base-200 border-t border-base-200">
          {#each section.errors as error (error.code)}
            <div
              id={error.code}
              class="scroll-mt-6 px-5 py-4 transition-colors {selectedCode === error.code
                ? 'bg-warning/10'
                : ''}"
            >
              <dt class="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span class="font-semibold text-base-content">{error.title}</span>
                <code class="badge badge-sm badge-error badge-outline">{error.code}</code>
              </dt>
              <dd class="mt-1 text-sm text-base-content/70">
                {error.summary}
                {#if error.cause}{error.cause}{/if}
              </dd>
              <dd class="mt-2 text-sm text-base-content/70">
                <span class="font-medium text-base-content">How to help:</span>
                {error.help}
              </dd>
            </div>
          {/each}
        </dl>
      </section>
    {/each}
  </div>

  <p class="mt-6 text-xs text-base-content/50">
    Based on Argyle's
    <ExternalLink href={ARGYLE_ERRORS_DOCS_URL}>account connection errors reference</ExternalLink>.
  </p>
</div>
