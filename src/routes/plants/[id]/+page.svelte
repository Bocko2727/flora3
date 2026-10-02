<script lang="ts">
	import Gallery from '$lib/components/Gallery.svelte';
	import LegacyAiPanel from '$lib/components/LegacyAiPanel.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const plant = $derived(data.plant);
</script>

<svelte:head><title>{plant.name_bg} · Флора</title></svelte:head>

<p><a href="/">← Каталог</a></p>

<header class="head">
	<h1>{plant.name_bg}</h1>
	<p class="latin"><em>{plant.scientific_name}</em>{#if plant.family}<span class="muted"> · {plant.family}</span>{/if}</p>
	<StatusBadge status={plant.id_status} nameSource={plant.name_source} explain />
</header>

{#if data.isEditor}
	<div class="actions">
		<a class="button" href={`/plants/${plant.id}/edit`}>Редактирай</a>
	</div>
{/if}

<section>
	<h2>Снимки</h2>
	{#if data.photos.length > 0}
		<Gallery photos={data.photos} alt={plant.name_bg} />
	{:else}
		<p class="muted">Няма снимки.</p>
	{/if}
</section>

{#each [{ title: 'Описание', text: plant.description }, { title: 'Местообитание', text: plant.habitat }, { title: 'Бележки', text: plant.notes }] as section (section.title)}
	{#if section.text}
		<section>
			<h2>{section.title}</h2>
			<p class="prose">{section.text}</p>
		</section>
	{/if}
{/each}

<LegacyAiPanel legacy={data.legacy} />

<style>
	.head h1 { margin-bottom: 0.25rem; }
	.latin { margin: 0 0 0.5rem; }
	.actions { display: flex; gap: 0.5rem; flex-wrap: wrap; margin: var(--gap) 0; }
	.prose { white-space: pre-line; margin: 0; }
</style>
