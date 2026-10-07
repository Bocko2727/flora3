<script lang="ts">
	import { AI_DRAFT_WARNING, LEGACY_AI_FIELDS, LEGACY_AI_QUESTIONS, type LegacyAi } from '$lib/types';

	let { legacy }: { legacy: LegacyAi | null } = $props();
	const fields = $derived(legacy ? LEGACY_AI_FIELDS.filter((field) => legacy[field]) : []);
</script>

<!-- The old AI text answers a fixed set of questions. Nothing here is verified; each answer says so. -->
{#if legacy && (fields.length > 0 || legacy.confidence)}
	<section class="qa" aria-labelledby="qa-title">
		<h2 id="qa-title">Въпроси и отговори</h2>
		<p class="warning">{AI_DRAFT_WARNING}</p>
		{#each fields as field (field)}
			<div class="item">
				<h3>{LEGACY_AI_QUESTIONS[field]} <span class="tag">AI текст · непроверен</span></h3>
				<p class="prose">{legacy[field]}</p>
			</div>
		{/each}
		{#if legacy.confidence}
			<p class="muted confidence">Старият AI е написал: {legacy.confidence}</p>
		{/if}
	</section>
{/if}

<style>
	.qa { margin-top: var(--space-5); }
	.qa h2 { margin-top: 0; }
	.warning {
		background: var(--warn-bg);
		color: var(--warn-text);
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-sm);
		font-size: var(--text-sm);
	}
	.item { border-top: 1px solid var(--border); padding-top: var(--space-3); margin-top: var(--space-3); }
	h3 {
		margin: 0;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		color: var(--accent);
		font-size: var(--text-base);
	}
	.tag {
		font-family: var(--font-body);
		font-size: var(--text-xs);
		font-weight: 600;
		color: var(--warn-text);
		background: var(--warn-bg);
		border: 1px solid currentColor;
		border-radius: 999px;
		padding: 0.1rem 0.5rem;
	}
	.prose { margin: var(--space-2) 0 0; white-space: pre-line; line-height: 1.6; max-width: 68ch; }
	.confidence { font-size: var(--text-sm); margin-top: var(--space-3); }
</style>
