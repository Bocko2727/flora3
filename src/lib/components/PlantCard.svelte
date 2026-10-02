<script lang="ts">
	type Props = {
		plant: { id: string; name_bg: string; scientific_name: string; status: string; thumbUrl: string | null };
	};
	let { plant }: Props = $props();
</script>

<a class="card" href={`/plants/${plant.id}`}>
	<div class="thumb">
		{#if plant.thumbUrl}
			<img src={plant.thumbUrl} alt="" loading="lazy" />
		{:else}
			<span class="no-photo muted">Без снимка</span>
		{/if}
	</div>
	<div class="text">
		<strong class="name">{plant.name_bg}</strong>
		<em class="latin muted">{plant.scientific_name}</em>
		{#if plant.status === 'confirmed'}
			<span class="badge confirmed">Потвърдено</span>
		{/if}
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
	.no-photo { font-size: 0.8rem; }
	.text { padding: 0.5rem 0.6rem 0.7rem; display: flex; flex-direction: column; gap: 0.15rem; align-items: flex-start; }
	.name { font-size: 0.95rem; line-height: 1.25; }
	.latin { font-size: 0.8rem; line-height: 1.2; }
</style>
