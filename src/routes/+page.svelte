<script lang="ts">
	import PlantCard from '$lib/components/PlantCard.svelte';
	import { filterPlants, type StatusFilter } from '$lib/catalog/filter';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let query = $state('');
	let status = $state<StatusFilter>('all');

	const visible = $derived(filterPlants(data.plants, query, status));
	const options: { value: StatusFilter; label: string }[] = [
		{ value: 'all', label: 'Всички' },
		{ value: 'unverified', label: 'Непотвърдени' },
		{ value: 'confirmed', label: 'Потвърдени' }
	];
</script>

<svelte:head><title>Каталог · Флора</title></svelte:head>

<div class="toolbar">
	<h1>Каталог</h1>
	{#if data.isEditor}
		<a class="button primary" href="/plants/new">+ Растение</a>
	{/if}
</div>

{#if data.plants.length === 0}
	<p class="muted">Още няма растения.</p>
{:else}
	<div class="filters">
		<label class="search">
			<span class="visually-hidden">Търси</span>
			<input type="search" placeholder="Търси по име…" bind:value={query} aria-label="Търси" />
		</label>
		<fieldset class="status">
			<legend class="visually-hidden">Статус</legend>
			{#each options as option (option.value)}
				<label class:active={status === option.value}>
					<input type="radio" name="status" value={option.value} bind:group={status} />
					{option.label}
				</label>
			{/each}
		</fieldset>
	</div>

	<p class="muted count" aria-live="polite">{visible.length} от {data.plants.length}</p>

	{#if visible.length === 0}
		<p class="muted">Няма растения, които отговарят на търсенето.</p>
	{:else}
		<ul class="grid">
			{#each visible as plant (plant.id)}
				<li><PlantCard {plant} /></li>
			{/each}
		</ul>
	{/if}
{/if}

<style>
	.toolbar { display: flex; align-items: center; justify-content: space-between; gap: var(--gap); }
	.toolbar h1 { margin: 0; }
	.filters { display: flex; flex-direction: column; gap: 0.75rem; margin: var(--gap) 0 0.25rem; }
	.status { display: flex; gap: 0.25rem; border: none; padding: 0; margin: 0; flex-wrap: wrap; }
	.status label {
		border: 1px solid var(--border);
		border-radius: 999px;
		padding: 0.35rem 0.9rem;
		min-height: 44px;
		display: inline-flex;
		align-items: center;
		cursor: pointer;
		background: var(--surface);
	}
	.status label.active { background: var(--accent); color: var(--accent-contrast); border-color: var(--accent); }
	.status input { position: absolute; opacity: 0; pointer-events: none; }
	.status label:has(input:focus-visible) { outline: 3px solid var(--accent); outline-offset: 2px; }
	.count { font-size: 0.85rem; margin: 0 0 0.5rem; }
	.grid {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 0.75rem;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
	}
</style>
