<script lang="ts">
  interface Props {
    url: string;
    name: string;
    borderClass: string;
    description?: string;
  }
  let { url, name, borderClass, description = '' }: Props = $props();
</script>

<a
  href={url}
  class="block bg-white rounded-lg border-l-4 {borderClass} p-4 cursor-pointer hover:bg-base-200/30 transition-colors duration-200"
>
  <div class="flex items-center justify-between gap-3">
    <div>
      <p class="font-semibold text-base-content">{name}</p>
      {#if description}
        <p class="text-sm text-base-content/50 mt-0.5">{description}</p>
      {/if}
    </div>
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class="h-5 w-5 text-base-content/30 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  </div>
</a>
