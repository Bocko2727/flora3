<script lang="ts">
	import { statusView, type IdStatus, type NameSource } from '$lib/status';

	type Props = { status: IdStatus; nameSource: NameSource; explain?: boolean };
	let { status, nameSource, explain = false }: Props = $props();
	const view = $derived(statusView(status, nameSource));
	const ICONS = { draft: '○', ai_gbif: '◐', community: '●' } as const;
</script>

<span class="status-badge {view.tone}"><i aria-hidden="true">{ICONS[view.tone]}</i><span>{view.label}</span></span>
{#if explain}<p class="status-explain muted">{view.explanation}</p>{/if}

<style>
	.status-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.8rem;
		line-height: 1.2;
		padding: 0.15rem 0.55rem;
		border-radius: 999px;
		border: 1px solid var(--border);
		color: var(--muted);
		background: transparent;
	}
	.status-badge i { font-style: normal; }
	.status-badge.draft { border-style: dashed; }
	.status-badge.ai_gbif { border-color: var(--accent); color: var(--text); }
	.status-badge.community { background: var(--accent); border-color: var(--accent); color: var(--accent-contrast); }
	.status-explain { font-size: 0.85rem; margin: 0.35rem 0 0; }
</style>
