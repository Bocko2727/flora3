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

	type Props = {
		initial: PlantFormValues;
		errors?: PlantFormErrors;
		legacy?: LegacyAi | null;
		/** Bind to read or set the fields from outside; without a binding the form owns a copy of `initial`. */
		values?: PlantFormValues;
	};
	let { initial, errors = {}, legacy = null, values = $bindable(untrack(() => ({ ...initial }))) }: Props = $props();

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

	const LEGACY_PREFIX = '[AI чернова — непроверено] ';
	const TEXT_MAX = 5000;
	let appended = $state<LegacyAiField[]>([]);
	let overflowing = $state<LegacyAiField[]>([]);

	function appendLegacy(field: LegacyAiField) {
		const text = legacy?.[field];
		if (!text || appended.includes(field)) return;
		const key = TARGET[field];
		const current = values[key].trim();
		const block = `${LEGACY_PREFIX}${text}`;
		const next = current ? `${current}\n\n${block}` : block;
		if (next.length > TEXT_MAX) {
			if (!overflowing.includes(field)) overflowing.push(field);
			return;
		}
		overflowing = overflowing.filter((item) => item !== field);
		values[key] = next;
		appended.push(field);
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
					<button type="button" disabled={appended.includes(field)} onclick={() => appendLegacy(field)}>
						{appended.includes(field) ? 'Добавено' : `Добави към ${TARGET_LABEL[TARGET[field]]}`}
					</button>
					{#if overflowing.includes(field)}
						<p class="field-error" role="alert">Текстът ще надхвърли {TEXT_MAX} знака.</p>
					{/if}
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
