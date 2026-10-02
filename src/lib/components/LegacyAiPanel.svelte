<script lang="ts">
	import { AI_DRAFT_TITLE, AI_DRAFT_WARNING, LEGACY_AI_FIELDS, LEGACY_AI_LABELS, type LegacyAi } from '$lib/types';

	let { legacy }: { legacy: LegacyAi | null } = $props();
	const fields = $derived(legacy ? LEGACY_AI_FIELDS.filter((field) => legacy[field]) : []);
</script>

{#if legacy && (fields.length > 0 || legacy.confidence)}
	<details class="legacy">
		<summary>{AI_DRAFT_TITLE}</summary>
		<p class="warning">{AI_DRAFT_WARNING}</p>
		<dl>
			{#each fields as field (field)}
				<dt>{LEGACY_AI_LABELS[field]}</dt>
				<dd>{legacy[field]}</dd>
			{/each}
			{#if legacy.confidence}
				<dt>Стара AI оценка</dt>
				<dd>{legacy.confidence}</dd>
			{/if}
		</dl>
	</details>
{/if}

<style>
	.legacy { border: 1px dashed var(--border); border-radius: var(--radius); padding: 0.5rem 0.75rem; margin-top: 1.5rem; }
	summary { cursor: pointer; font-weight: 600; min-height: 44px; display: flex; align-items: center; }
	.warning { background: var(--warn-bg); color: var(--warn-text); padding: 0.5rem 0.75rem; border-radius: 8px; }
	dt { font-weight: 600; margin-top: 0.75rem; }
	dd { margin: 0; white-space: pre-line; }
</style>
