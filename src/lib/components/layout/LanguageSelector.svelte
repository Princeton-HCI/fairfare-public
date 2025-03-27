<script lang="ts">
  import { locale, locales } from 'svelte-i18n';
  import { supabase } from '@src/lib/client/db';
  import { toast } from '@src/lib/toasts';

  const localeToPrettyString = (l: string) => {
    if (l.startsWith('en')) return 'English (US)';
    if (l.startsWith('es')) return 'Español (US)';
    if (l.startsWith('fr')) return 'Français (FR)';
    return l;
  };

  const updateUserLanguage = async (e: Event) => {
    const select = e.target as HTMLSelectElement;
    const newLocale = select.value;
    const { error } = await supabase.auth.updateUser({
      data: { preferred_language: newLocale }
    });
    if (error?.message == 'Auth session missing!') {
      // do nothing, the user is not logged in
      return;
    }
    if (error) {
      toast({ text: 'Failed to update your preferred language', type: 'error' });
      console.log(error);
      return;
    }
  };
</script>

<div class="pb-4">
  <select
    bind:value={$locale}
    aria-label="Language"
    onchange={updateUserLanguage}
    id="language-select"
    class="select select-ghost select-sm"
  >
    {#each $locales as l}
      <option value={l} selected={l === $locale}>{localeToPrettyString(l)}</option>
    {/each}
  </select>
</div>
