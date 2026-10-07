<script lang="ts">
	import Evidence from '$lib/components/Evidence.svelte';
	import Gallery from '$lib/components/Gallery.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import { LEGACY_AI_FIELDS, LEGACY_AI_LABELS } from '$lib/types';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const plant = $derived(data.plant);
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

	const legacyFields = $derived(data.legacy ? LEGACY_AI_FIELDS.filter((field) => data.legacy?.[field]) : []);
	const facts = $derived(
		[
			{ label: 'Българско име', value: plant.name_bg },
			{ label: 'Научно име', value: plant.scientific_name, latin: true },
			{ label: 'Семейство', value: plant.family },
			{ label: 'Местообитание', value: plant.habitat },
			{ label: 'Бележки', value: plant.notes }
		].filter((fact) => fact.value)
	);

	type Tab = 'info' | 'evidence';
	let tab = $state<Tab>('info');
	const TABS: { id: Tab; label: string }[] = [
		{ id: 'info', label: 'Информация' },
		{ id: 'evidence', label: 'Доказателства' }
	];
	function onTabKey(event: KeyboardEvent) {
		if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
		event.preventDefault();
		tab = tab === 'info' ? 'evidence' : 'info';
		document.getElementById(`tab-${tab}`)?.focus();
	}
</script>

<svelte:head><title>{plant.name_bg} · Флора</title></svelte:head>

<div class="plant">
	<p class="back"><a href="/">← Каталог</a></p>

	<!-- Left: the specimen and its name. Right: what it is. Below: the record, split in two tabs. -->
	<div class="top">
		<div class="media">
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

			<header class="name">
				<h1>{plant.name_bg}</h1>
				<p class="latin">{plant.scientific_name}</p>
				{#if plant.family}<p class="family">{plant.family}</p>{/if}
			</header>

			{#if primary}
				<section class="more-photos">
					{#if data.photos.length > 1}<h2 class="visually-hidden">Снимки</h2>{/if}
					<Gallery bind:this={gallery} photos={data.photos} alt={plant.name_bg} from={1} />
				</section>
			{/if}
		</div>

		<div class="about">
			{#if plant.description}
				<h2>Описание</h2>
				<p class="prose">{plant.description}</p>
				{#if plant.description_source === 'wikipedia' && plant.wiki_url}
					<p class="muted source">Из Уикипедия · <a href={plant.wiki_url} target="_blank" rel="noopener">статията</a> · CC BY-SA 4.0</p>
				{/if}
			{:else}
				<p class="muted">Все още няма описание.</p>
			{/if}
		</div>
	</div>

	<section class="record" aria-label="Данни за растението">
		<div class="tabs" role="tablist" aria-label="Данни за растението" tabindex="-1" onkeydown={onTabKey}>
			{#each TABS as item (item.id)}
				<button
					type="button"
					role="tab"
					id={`tab-${item.id}`}
					class="tab"
					aria-selected={tab === item.id}
					aria-controls={`panel-${item.id}`}
					tabindex={tab === item.id ? 0 : -1}
					onclick={() => (tab = item.id)}>{item.label}</button
				>
			{/each}
		</div>

		<div role="tabpanel" id="panel-info" aria-labelledby="tab-info" class="panel" hidden={tab !== 'info'}>
			<dl class="facts">
				{#each facts as fact (fact.label)}
					<dt>{fact.label}</dt>
					<dd class:latin={fact.latin}>{fact.value}</dd>
				{/each}
			</dl>

			{#if legacyFields.length > 0 && data.legacy}
				<h2>Допълнително</h2>
				<dl class="facts">
					{#each legacyFields as field (field)}
						<dt>{LEGACY_AI_LABELS[field]}</dt>
						<dd class="prose">{data.legacy[field]}</dd>
					{/each}
				</dl>
				<p class="muted source">Източник: стар AI текст, не е проверен от човек.</p>
			{/if}
		</div>

		<div role="tabpanel" id="panel-evidence" aria-labelledby="tab-evidence" class="panel" hidden={tab !== 'evidence'}>
			<StatusBadge status={plant.id_status} nameSource={plant.name_source} explain />
			<Evidence plant={plant} latest={data.latest} isEditor={data.isEditor} message={form?.message} />
			{#if data.isEditor}
				<div class="actions">
					<a class="button" href={`/plants/${plant.id}/edit`}>Редактирай</a>
				</div>
			{/if}
		</div>
	</section>
</div>

<style>
	.plant { max-width: 720px; margin: 0 auto; }
	.back { margin: 0 0 var(--space-3); }
	.back a { display: inline-flex; align-items: center; min-height: 44px; text-decoration: none; }
	.back a:hover { text-decoration: underline; }

	.top { display: grid; gap: var(--space-4); }
	.media, .about { min-width: 0; }

	.specimen {
		display: block;
		width: 100%;
		padding: 0;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface);
		overflow: hidden;
		min-height: 120px;
	}
	.specimen img { display: block; width: 100%; height: auto; max-height: min(60vh, 560px); object-fit: cover; }
	.specimen .muted { display: block; padding: var(--space-6) var(--space-4); }
	.specimen.empty { margin: 0; padding: var(--space-6) var(--space-4); text-align: center; display: grid; place-items: center; }

	/* The common (Bulgarian) name leads; the Latin name is smaller. */
	.name { margin: var(--space-3) 0; }
	.name p { margin: 0; overflow-wrap: anywhere; }
	.name h1 { font-size: var(--text-2xl); line-height: 1.15; margin: 0; overflow-wrap: anywhere; }
	.name .latin { font-size: var(--text-base); color: var(--muted); margin-top: var(--space-1); }
	.family { font-size: 0.6875rem; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); margin-top: var(--space-1) !important; }

	.more-photos { margin: 0; }

	.about h2 { margin-top: 0; }
	.prose { white-space: pre-line; margin: 0; max-width: 65ch; }
	.source { font-size: var(--text-xs); margin: var(--space-2) 0 0; }

	.record { margin-top: var(--space-5); }
	.tabs { display: flex; gap: var(--space-1); border-bottom: 1px solid var(--border); }
	.tab {
		min-height: 44px;
		padding: 0 var(--space-4);
		border: 1px solid transparent;
		border-bottom: none;
		border-radius: var(--radius-sm) var(--radius-sm) 0 0;
		background: transparent;
		color: var(--muted);
		font-weight: 600;
	}
	.tab[aria-selected='true'] { background: var(--surface); border-color: var(--border); color: var(--text); box-shadow: 0 1px 0 var(--surface); margin-bottom: -1px; }
	.panel { background: var(--surface); border: 1px solid var(--border); border-top: none; border-radius: 0 0 var(--radius-sm) var(--radius-sm); padding: var(--space-4); }
	.panel[hidden] { display: none; }
	.panel :global(.evidence) { margin-top: var(--space-3); }
	.panel h2 { margin-top: var(--space-5); }

	.facts { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: var(--space-2) var(--space-4); margin: 0; font-size: var(--text-sm); }
	.facts dt { color: var(--muted); }
	.facts dd { margin: 0; overflow-wrap: anywhere; }
	.facts dd.latin { font-size: var(--text-sm); }
	.actions { display: flex; gap: var(--space-2); flex-wrap: wrap; margin-top: var(--space-4); }

	/* Phone: one column — photo, name, description, then the tabs. */
	@media (min-width: 900px) {
		.plant { max-width: 1120px; }
		.top {
			grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
			column-gap: var(--space-5);
			align-items: start;
		}
		.specimen img { object-fit: contain; max-height: calc(100dvh - 22rem); }
		.about { padding-top: var(--space-1); }
		.about h2 { font-size: var(--text-lg); }
	}
</style>
