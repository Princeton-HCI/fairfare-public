<script lang="ts">
  let {
    label,
    description,
    name,
    value = $bindable(),
    max
  } = $props<{
    label: string;
    description?: string;
    name: string;
    value: string;
    max?: Date;
  }>();

  function formatDate(date: Date) {
    let month = (date.getMonth() + 1).toString().padStart(2, '0');
    let day = date.getDate().toString().padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
  }
  const maxDate = $derived(formatDate(max));

  $effect(() => {
    if (max && value > maxDate) {
      value = maxDate;
    }
  });
</script>

<div class="mb-1">
  <div class="flex justify-between">
    <label for={name} class="font-medium">{label}</label>
    {#if max}
      <input
        type="date"
        {name}
        bind:value
        class="input w-full max-w-[10rem] border border-black bg-white"
        max={maxDate}
      />
    {:else}
      <input
        type="date"
        {name}
        bind:value
        class="input w-full max-w-[10rem] border border-black bg-white"
      />
    {/if}
  </div>
  {#if description}
    <small class="block text-xs text-gray-500">{description}</small>
  {/if}
</div>
