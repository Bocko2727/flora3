<script lang="ts">
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import type { IdStatus, NameSource } from '$lib/status';

	type Props = {
		plant: {
			id: string;
			name_bg: string;
			scientific_name: string;
			id_status: IdStatus;
			name_source: NameSource;
			thumbUrl: string | null;
			photoState: 'none' | 'ok' | 'failed';
		};
	};
	let { plant }: Props = $props();
	let imageFailed = $state(false);
	const failed = $derived(plant.photoState === 'failed' || imageFailed);
	const showImage = $derived(plant.photoState === 'ok' && plant.thumbUrl !== null && !imageFailed);
</script>

<a class="card" class:photo={showImage} href={`/plants/${plant.id}`}>
	{#if showImage}
		<img src={plant.thumbUrl} alt="" loading="lazy" decoding="async" onerror={() => (imageFailed = true)} />
	{:else}
		<span class="no-photo" aria-hidden="true">{failed ? 'Снимката не можа да се зареди' : 'Без снимка'}</span>
	{/if}
	<div class="text">
		<strong class="name">{plant.name_bg}</strong>
		<em class="latin">{plant.scientific_name}</em>
		<StatusBadge status={plant.id_status} nameSource={plant.name_source} />
	</div>
</a>

<style>
	.card {
		position: relative;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		aspect-ratio: 3 / 4;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		overflow: hidden;
		text-decoration: none;
		color: var(--text);
		isolation: isolate;
	}
	.card:hover { border-color: var(--line-strong); }
	img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		z-index: -1;
		transition: transform 0.3s ease;
	}
	.card:hover img { transform: scale(1.03); }
	.no-photo {
		position: absolute;
		inset: 0 0 auto;
		padding: var(--space-4) var(--space-2) 0;
		text-align: center;
		font-size: var(--text-xs);
		color: var(--muted);
	}
	.text {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 2px;
		min-width: 0;
		padding: var(--space-6) var(--space-3) var(--space-3);
	}
	/* The scrim keeps the text readable over bright photos. */
	.photo .text {
		padding-top: calc(var(--space-6) + 2rem);
		background: linear-gradient(
			to bottom,
			rgb(8 14 12 / 0) 0%,
			rgb(8 14 12 / 0.25) 18%,
			rgb(8 14 12 / 0.6) 40%,
			rgb(8 14 12 / 0.85) 65%,
			var(--scrim) 100%
		);
	}
	.name { font-size: 0.9375rem; font-weight: 600; line-height: 1.25; overflow-wrap: anywhere; color: #f2f6f3; }
	.latin { font-size: var(--text-sm); line-height: 1.25; overflow-wrap: anywhere; color: #c3cfc8; margin-bottom: var(--space-1); }
	@media (prefers-reduced-motion: reduce) {
		img { transition: none; }
		.card:hover img { transform: none; }
	}
</style>
