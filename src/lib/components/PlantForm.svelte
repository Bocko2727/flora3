<script lang="ts">
	import { untrack } from 'svelte';
	import type { PlantFormErrors, PlantFormValues } from '$lib/schemas/plant';
	import {
		AI_DRAFT_TITLE,
		AI_DRAFT_WARNING,
		LEGACY_AI_FIELDS,
		LEGACY_AI_LABELS,
		type LegacyAi,
		type LegacyAiField
	} from '$lib/types';

	type Props = { initial: PlantFormValues; errors?: PlantFormErrors; legacy?: LegacyAi | null };
	let { initial, errors = {}, legacy = null }: Props = $props();

	let values = $state(untrack(() => ({ ...initial })));

	type TextTarget = 'description' | 'habitat' | 'notes';
	const TARGET: Record<LegacyAiField, TextTarget> = {
		recognition: 'description',
		habitat: 'habitat',
		lookalikes: 'notes',
		benefits: 'notes',
		risks: 'notes',
		uses: 'notes',
		fun_fact: 'notes'
	};
	const TARGET_LABEL: Record<TextTarget, string> = { description: 'Описание', habitat: 'Местообитание', notes: 'Бележки' };
	const legacyFields = $derived(legacy ? LEGACY_AI_FIELDS.filter((field) => legacy[field]) : []);

	function appendLegacy(field: LegacyAiField) {
		const text = legacy?.[field];
		if (!text) return;
		const key = TARGET[field];
		const current = values[key].trim();
		values[key] = current ? `${current}\n\n${text}` : text;
	}

	const fields: { name: keyof PlantFormValues; label: string; max: number; multiline: boolean; required: boolean }[] = [
		{ name: 'name_bg', label: 'Българско име', max: 200, multiline: false, required: true },
		{ name: 'scientific_name', label: 'Латинско име', max: 200, multiline: false, required: true },
		{ name: 'family', label: 'Семейство', max: 100, multiline: false, required: false },
		{ name: 'description', label: 'Описание', max: 5000, multiline: true, required: false },
		{ name: 'habitat', label: 'Местообитание', max: 5000, multiline: true, required: false },
		{ name: 'notes', label: 'Бележки', max: 5000, multiline: true, required: false }
	];
</script>

<div class="stack">
	{#each fields as field (field.name)}
		<div class="field">
			<label for={field.name}>{field.label}{field.required ? ' *' : ''}</label>
			{#if field.multiline}
				<textarea
					id={field.name}
					name={field.name}
					maxlength={field.max}
					bind:value={values[field.name]}
					aria-invalid={errors[field.name] ? 'true' : undefined}
					aria-describedby={errors[field.name] ? `${field.name}-error` : undefined}
				></textarea>
			{:else}
				<input
					id={field.name}
					name={field.name}
					maxlength={field.max}
					required={field.required}
					autocomplete="off"
					bind:value={values[field.name]}
					aria-invalid={errors[field.name] ? 'true' : undefined}
					aria-describedby={errors[field.name] ? `${field.name}-error` : undefined}
				/>
			{/if}
			{#if errors[field.name]}
				<p class="field-error" id={`${field.name}-error`}>{errors[field.name]}</p>
			{/if}
		</div>
	{/each}

	{#if legacyFields.length > 0}
		<details class="legacy">
			<summary>{AI_DRAFT_TITLE}</summary>
			<p class="warning">{AI_DRAFT_WARNING}</p>
			{#each legacyFields as field (field)}
				<div class="legacy-item">
					<strong>{LEGACY_AI_LABELS[field]}</strong>
					<p>{legacy?.[field]}</p>
					<button type="button" onclick={() => appendLegacy(field)}>
						Добави към {TARGET_LABEL[TARGET[field]]}
					</button>
				</div>
			{/each}
		</details>
	{/if}
</div>

<style>
	.legacy { border: 1px dashed var(--border); border-radius: var(--radius); padding: 0.5rem 0.75rem; }
	summary { cursor: pointer; font-weight: 600; min-height: 44px; display: flex; align-items: center; }
	.warning { background: var(--warn-bg); color: var(--warn-text); padding: 0.5rem 0.75rem; border-radius: 8px; }
	.legacy-item { border-top: 1px solid var(--border); padding: 0.5rem 0; }
	.legacy-item p { white-space: pre-line; margin: 0.25rem 0 0.5rem; }
</style>
