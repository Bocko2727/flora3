<script lang="ts">
	import Evidence from '$lib/components/Evidence.svelte';
	import Gallery from '$lib/components/Gallery.svelte';
	import LegacyAiPanel from '$lib/components/LegacyAiPanel.svelte';
	import { sameName } from '$lib/identify/types';
	import { statusView } from '$lib/status';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const plant = $derived(data.plant);
	const view = $derived(statusView(plant.id_status, plant.name_source));
	const primary = $derived(data.photos[0] ?? null);

	let gallery = $state<ReturnType<typeof Gallery>>();
	// Full-size first, then the thumbnail, then a text fallback.
	// A writable derived: it starts again at 0 whenever another primary photo arrives.
	let heroStage = $derived.by(() => {
		void primary?.id;
		return 0;
	});
	const heroUrl = $derived(
		!primary ? null : heroStage === 0 ? (primary.url ?? primary.thumbUrl) : heroStage === 1 ? primary.thumbUrl : null
	);

	const NAME_CHECK: Record<string, string> = {
		accepted: 'GBIF прието',
		synonym: 'GBIF синоним',
		doubtful: 'GBIF съмнително',
		none: 'няма в GBIF'
	};
	const aiMatch = $derived(
		data.latest?.candidates.find((candidate) => sameName(candidate.scientific_name, plant.scientific_name)) ?? null
	);
	const determinedBy = $derived(
		aiMatch
			? `Pl@ntNet ${Math.round(aiMatch.score * 100)}\u00a0%`
			: plant.name_source === 'manual'
				? 'ръчно'
				: plant.name_source === 'legacy_ai'
					? 'стар AI'
					: 'Pl@ntNet'
	);
	const nameCheck = $derived(plant.gbif_match ? (NAME_CHECK[plant.gbif_match] ?? plant.gbif_match) : 'не е проверено');
</script>

<svelte:head><title>{plant.name_bg} · Флора</title></svelte:head>

<div class="plant">
	<p class="back"><a href="/">← Каталог</a></p>

	<article class="sheet">
		{#if primary}
			<button
				type="button"
				class="specimen"
				onclick={() => gallery?.open(0)}
				aria-label={`Отвори снимка 1 от ${data.photos.length}`}
			>
				{#if heroUrl}
					<img
						src={heroUrl}
						alt=""
						width={primary.width}
						height={primary.height}
						fetchpriority="high"
						decoding="async"
						onerror={() => (heroStage += 1)}
					/>
				{:else}
					<span class="muted">Снимката липсва</span>
				{/if}
			</button>
		{:else}
			<p class="specimen empty muted">Няма снимки.</p>
		{/if}

		<div class="specimen-label">
			{#if plant.family}<p class="family">{plant.family}</p>{/if}
			<p class="latin">{plant.scientific_name}</p>
			<h1>{plant.name_bg}</h1>
			<p class="det num">det.: {determinedBy} · име: {nameCheck}</p>
		</div>
		<p class="stamp {view.tone}"><span class="visually-hidden">Статус: </span><span>{view.label}</span></p>
		<p class="explain muted">{view.explanation}</p>
	</article>

	<Evidence plant={plant} latest={data.latest} isEditor={data.isEditor} message={form?.message} />

	{#if data.isEditor}
		<div class="actions">
			<a class="button" href={`/plants/${plant.id}/edit`}>Редактирай</a>
		</div>
	{/if}

	{#if primary}
		<section>
			{#if data.photos.length > 1}<h2>Снимки</h2>{/if}
			<Gallery bind:this={gallery} photos={data.photos} alt={plant.name_bg} from={1} />
		</section>
	{/if}

	{#each [{ title: 'Описание', text: plant.description }, { title: 'Местообитание', text: plant.habitat }, { title: 'Бележки', text: plant.notes }] as section (section.title)}
		{#if section.text}
			<section>
				<h2>{section.title}</h2>
				<p class="prose">{section.text}</p>
				{#if section.title === 'Описание' && plant.description_source === 'wikipedia' && plant.wiki_url}
					<p class="muted source">Из Уикипедия · <a href={plant.wiki_url} target="_blank" rel="noopener">статията</a> · CC BY-SA 4.0</p>
				{/if}
			</section>
		{/if}
	{/each}

	<LegacyAiPanel legacy={data.legacy} />
</div>

<style>
	.source { font-size: var(--text-xs); margin-top: var(--space-1); }
	.plant { max-width: 720px; margin: 0 auto; }
	.back { margin: 0 0 var(--space-3); }
	.back a { display: inline-flex; align-items: center; min-height: 44px; text-decoration: none; }
	.back a:hover { text-decoration: underline; }

	/* Herbarium sheet: the specimen lies on the paper, the label sits below it, the status is a stamp. */
	.sheet {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		box-shadow: var(--shadow-sheet);
		padding: var(--space-3);
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: start;
		column-gap: var(--space-3);
	}
	.specimen,
	.specimen-label,
	.explain { grid-column: 1 / -1; }
	.specimen {
		display: block;
		width: 100%;
		padding: 0;
		border: none;
		border-radius: 4px;
		background: var(--bg);
		overflow: hidden;
		min-height: 120px;
	}
	.specimen img { width: 100%; height: auto; max-height: min(70vh, 640px); object-fit: cover; }
	.specimen .muted { display: block; padding: var(--space-6) var(--space-4); }
	.specimen.empty { margin: 0; padding: var(--space-6) var(--space-4); text-align: center; display: grid; place-items: center; }

	.specimen-label {
		margin: var(--space-3) 0 0 auto;
		width: min(100%, 30rem);
		border: 1px solid var(--text);
		padding: var(--space-2) var(--space-3) var(--space-3);
		display: grid;
		gap: 2px;
		min-width: 0;
	}
	.specimen-label p { margin: 0; overflow-wrap: anywhere; }
	.family { font-size: 0.6875rem; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); }
	.specimen-label .latin { font-size: var(--text-xl); line-height: 1.15; }
	.specimen-label h1 { font-family: var(--font-body); font-size: var(--text-base); font-weight: 600; letter-spacing: 0; margin: var(--space-1) 0 0; }
	.det { font-size: var(--text-xs); color: var(--muted); margin-top: var(--space-1) !important; }

	.stamp {
		grid-column: 2;
		grid-row: 3;
		width: 88px;
		height: 88px;
		margin: -0.75rem var(--space-2) 0 0;
		border-radius: 50%;
		border: 1.5px solid var(--accent);
		color: var(--accent);
		display: grid;
		place-items: center;
		padding: 3px;
		text-align: center;
		font-family: var(--font-display);
		font-size: var(--text-xs);
		font-weight: 600;
		line-height: 1.1;
		letter-spacing: -0.01em;
		transform: rotate(-8deg);
		background: var(--surface);
	}
	.stamp.draft { border-style: dashed; }
	/* The longest label needs a smaller size to clear the ring. */
	.stamp.community span:last-child { font-size: 0.6875rem; }
	.stamp.community { background: var(--accent); color: var(--accent-contrast); box-shadow: 0 0 0 2px var(--surface), 0 0 0 3.5px var(--accent); }
	.explain { grid-column: 1; grid-row: 3; align-self: center; font-size: var(--text-sm); margin: var(--space-2) 0 0; }

	.actions { display: flex; gap: var(--space-2); flex-wrap: wrap; margin: var(--space-4) 0; }
	.prose { white-space: pre-line; margin: 0; max-width: 65ch; }
</style>
