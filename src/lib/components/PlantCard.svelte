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
</script>

<a class="card" href={`/plants/${plant.id}`}>
	<div class="thumb">
		{#if plant.photoState === 'ok' && plant.thumbUrl && !imageFailed}
			<img src={plant.thumbUrl} alt="" loading="lazy" onerror={() => (imageFailed = true)} />
		{:else if failed}
			<span class="no-photo muted" aria-hidden="true">Снимката не можа да се зареди</span>
		{:else}
			<span class="no-photo muted" aria-hidden="true">Без снимка</span>
		{/if}
	</div>
	<div class="text">
		<strong class="name">{plant.name_bg}</strong>
		<em class="latin muted">{plant.scientific_name}</em>
		<StatusBadge status={plant.id_status} nameSource={plant.name_source} />
	</div>
</a>

<style>
	.card {
		display: flex;
		flex-direction: column;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		overflow: hidden;
		text-decoration: none;
		color: var(--text);
		height: 100%;
	}
	.thumb { aspect-ratio: 1; background: var(--bg); display: grid; place-items: center; }
	.thumb img { width: 100%; height: 100%; object-fit: cover; }
	.no-photo { font-size: 0.8rem; text-align: center; padding: 0.25rem; }
	.text { padding: 0.5rem 0.6rem 0.7rem; display: flex; flex-direction: column; gap: 0.15rem; align-items: flex-start; min-width: 0; }
	.name { font-size: 0.95rem; line-height: 1.25; overflow-wrap: anywhere; }
	.latin { font-size: 0.8rem; line-height: 1.2; overflow-wrap: anywhere; }
</style>
