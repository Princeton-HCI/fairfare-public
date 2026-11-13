<script lang="ts">
  interface Props {
    label: string;
    bottomLabel?: string;
    type?: string;
    name: string;
    maxlength?: number;
    minlength?: number;
    min?: number;
    max?: number;
    step?: number;
    required?: boolean;
    pattern?: string;
    disabled?: boolean;
    readonly?: boolean;
    placeholder?: string;
    element?: HTMLInputElement;
    value?: string;
  }

  let {
    label,
    bottomLabel,
    type = 'text',
    name,
    maxlength,
    minlength,
    min,
    max,
    step,
    required,
    pattern,
    disabled,
    readonly,
    placeholder = '',
    element = $bindable(),
    value = $bindable('')
  }: Props = $props();
</script>

<label class="form-control w-full max-w-prose">
  <div class="label pb-0 pl-0">
    <span class="label-text">{label}</span>
  </div>
  <input
    class="input w-full max-w-prose border border-black"
    {type}
    {name}
    {maxlength}
    {minlength}
    {min}
    {max}
    {step}
    {required}
    {pattern}
    {disabled}
    {readonly}
    {placeholder}
    bind:this={element}
    bind:value
    oninput={(e: Event) => {
      const target = e.target as HTMLInputElement;
      if (maxlength && target.value.length > maxlength) {
        target.value = target.value.slice(0, maxlength);
      }
      value = target.value;
    }}
  />
  {#if bottomLabel}
    <div class="label pl-0 pt-0.5">
      <span class="label-text-alt">{bottomLabel}</span>
    </div>
  {/if}
</label>
