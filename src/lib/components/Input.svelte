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
    required?: boolean;
    pattern?: string;
    disabled?: boolean;
    readonly?: boolean;
    placeholder?: string;
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
    required,
    pattern,
    disabled,
    readonly,
    placeholder = ''
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
    {required}
    {pattern}
    {disabled}
    {readonly}
    {placeholder}
  />
  {#if bottomLabel}
    <div class="label pl-0 pt-0.5">
      <span class="label-text-alt">{bottomLabel}</span>
    </div>
  {/if}
</label>
