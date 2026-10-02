<script lang="ts">
	import { enhance } from '$app/forms';
	import Gallery from '$lib/components/Gallery.svelte';
	import LegacyAiPanel from '$lib/components/LegacyAiPanel.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let busy = $state(false);
	const plant = $derived(data.plant);
	const confirmedOn = $derived(
		plant.confirmed_at ? new Date(plant.confirmed_at).toLocaleDateString('bg-BG') : null
	);
</script>

<svelte:head><title>{plant.name_bg} · Флора</title></svelte:head>

<p><a href="/">← Каталог</a></p>

<header class="head">
	<h1>{plant.name_bg}</h1>
	<p class="latin"><em>{plant.scientific_name}</em>{#if plant.family}<span class="muted"> · {plant.family}</span>{/if}</p>
	{#if plant.status === 'confirmed'}
		<span class="badge confirmed">Потвърдено</span>
		{#if confirmedOn}<span class="muted small"> на {confirmedOn}</span>{/if}
	{:else}
		<span class="badge">Непотвърдено</span>
	{/if}
</header>

{#if data.isEditor}
	<div class="actions">
		<a class="button" href={`/plants/${plant.id}/edit`}>Редактирай</a>
		<form
			method="POST"
			action={plant.status === 'confirmed' ? '?/unconfirm' : '?/confirm'}
			use:enhance={() => {
				busy = true;
				return async ({ update }) => {
					try {
						await update();
					} finally {
						busy = false;
					}
				};
			}}
		>
			<button type="submit" class={plant.status === 'confirmed' ? '' : 'primary'} disabled={busy}>
				{plant.status === 'confirmed' ? 'Върни като непотвърдено' : 'Потвърди'}
			</button>
		</form>
	</div>
	{#if form?.message}<p class="error" role="alert">{form.message}</p>{/if}
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
	.small { font-size: 0.85rem; }
	.actions { display: flex; gap: 0.5rem; flex-wrap: wrap; margin: var(--gap) 0; }
	.actions form { margin: 0; }
	.prose { white-space: pre-line; margin: 0; }
</style>
