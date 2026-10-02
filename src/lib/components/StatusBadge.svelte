<script lang="ts">
	import { statusView, type IdStatus, type NameSource } from '$lib/status';

	type Props = { status: IdStatus; nameSource: NameSource; explain?: boolean };
	let { status, nameSource, explain = false }: Props = $props();
	const view = $derived(statusView(status, nameSource));
</script>

<!-- The mark's shape carries the level (empty → half → full circle), so colour is never the only cue. -->
<span class="status-badge {view.tone}"><i aria-hidden="true"></i><span>{view.label}</span></span>
{#if explain}<p class="status-explain muted">{view.explanation}</p>{/if}

<style>
	.status-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		max-width: 100%;
		font-size: var(--text-xs);
		font-weight: 600;
		line-height: 1.2;
		padding: 0.25rem 0.55rem 0.25rem 0.45rem;
		border-radius: 999px;
		border: 1px solid var(--muted);
		color: var(--muted);
		background: rgb(14 23 20 / 0.6);
	}
	.status-badge i {
		flex: none;
		width: 0.625rem;
		height: 0.625rem;
		border-radius: 50%;
		border: 1.5px solid currentColor;
	}
	.draft { border-style: dashed; }
	.ai_gbif { border-color: var(--accent); color: var(--accent); }
	.ai_gbif i { background: linear-gradient(90deg, currentColor 50%, transparent 50%); }
	.community { background: var(--accent); border-color: var(--accent); color: var(--accent-contrast); }
	.community i { background: currentColor; }
	.status-explain { font-size: var(--text-sm); margin: var(--space-2) 0 0; }
</style>
