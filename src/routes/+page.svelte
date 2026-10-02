<script lang="ts">
	import { afterNavigate, goto } from '$app/navigation';
	import { page } from '$app/state';
	import { untrack } from 'svelte';
	import Pagination from '$lib/components/Pagination.svelte';
	import PlantCard from '$lib/components/PlantCard.svelte';
	import { filterPlants, paginate, parseCatalogParams, type PageSize, type StatusFilter } from '$lib/catalog/filter';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const params = $derived(parseCatalogParams(page.url.searchParams));
	// Typed text lives here so a URL update still in flight never overwrites what is being typed.
	let query = $state(untrack(() => params.q));
	afterNavigate(({ type }) => {
		if (type !== 'goto') query = params.q;
	});

	const visible = $derived(filterPlants(data.plants, query, params.s));
	// Until the URL catches up with a new search, show its first page.
	const shown = $derived(paginate(visible, query === params.q ? params.p : 1, params.n));

	const options: { value: StatusFilter; label: string }[] = [
		{ value: 'all', label: 'Всички' },
		{ value: 'draft', label: 'Чернови' },
		{ value: 'ai_gbif', label: 'Прието име' },
		{ value: 'community', label: 'Потвърдени' }
	];

	function catalogHref(q: string, s: StatusFilter, n: PageSize, p: number): string {
		const search = new URLSearchParams({ n: String(n) });
		if (p > 1) search.set('p', String(p));
		if (q.trim() !== '') search.set('q', q);
		if (s !== 'all') search.set('s', s);
		return `/?${search}`;
	}

	/** Search and status changes start again from page 1 and replace the history entry. */
	function applyFilters(q: string, s: StatusFilter) {
		void goto(catalogHref(q, s, params.n, 1), { replaceState: true, keepFocus: true, noScroll: true });
	}
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
			<input
				type="search"
				placeholder="Търси по име или латински…"
				value={query}
				oninput={(event) => {
					query = event.currentTarget.value;
					applyFilters(query, params.s);
				}}
				aria-label="Търси"
				autocomplete="off"
			/>
		</label>
		<fieldset class="status">
			<legend class="visually-hidden">Статус</legend>
			{#each options as option (option.value)}
				<label>
					<input
						type="radio"
						name="status"
						value={option.value}
						checked={params.s === option.value}
						onchange={() => applyFilters(query, option.value)}
					/>
					{option.label}
				</label>
			{/each}
		</fieldset>
	</div>

	<p class="muted count num" aria-live="polite">{visible.length} от {data.plants.length}</p>

	{#if visible.length === 0}
		<p class="muted">Няма растения, които отговарят на търсенето.</p>
	{:else}
		<ul class="grid" aria-label="Растения">
			{#each shown.items as plant (plant.id)}
				<li><PlantCard {plant} /></li>
			{/each}
		</ul>
		<Pagination
			page={shown.page}
			pages={shown.pages}
			size={params.n}
			href={(p, n) => catalogHref(query, params.s, n, p)}
		/>
	{/if}
{/if}

<style>
	.toolbar { display: flex; align-items: center; justify-content: space-between; gap: var(--gap); }
	.toolbar h1 { margin: 0; }
	.filters { display: flex; flex-direction: column; gap: var(--space-2); margin: var(--space-4) 0 var(--space-2); }
	.search input { background: var(--surface); }
	/* One scrollable row of chips on narrow phones instead of a second line; reaches the screen edges. */
	.status {
		display: flex;
		gap: 6px;
		border: none;
		min-inline-size: 0;
		margin: 0 calc(-1 * var(--space-4));
		padding: 4px var(--space-4);
		overflow-x: auto;
		scrollbar-width: none;
	}
	.status::-webkit-scrollbar { display: none; }
	.status label {
		border: 1px solid var(--line-strong);
		border-radius: 999px;
		padding: 0 var(--space-3);
		min-height: 44px;
		display: inline-flex;
		align-items: center;
		cursor: pointer;
		font-size: var(--text-sm);
		font-weight: 500;
		color: var(--muted);
		background: transparent;
		position: relative;
		flex: none;
		white-space: nowrap;
	}
	.status label:has(input:checked) { background: var(--text); color: var(--bg); border-color: var(--text); font-weight: 600; }
	.status input { position: absolute; opacity: 0; pointer-events: none; }
	.status label:has(input:focus-visible) { outline: 3px solid var(--accent); outline-offset: 2px; }
	.count { font-size: var(--text-sm); margin: 0 0 var(--space-3); }
	.grid {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: var(--space-3);
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
	@media (min-width: 640px) {
		.grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-4); }
	}
	@media (min-width: 1024px) {
		.grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
	}
</style>
