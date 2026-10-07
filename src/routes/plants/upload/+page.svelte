<script lang="ts">
	import UploadDraftCard from '$lib/components/UploadDraftCard.svelte';
	import { IDENTIFY_MAX_IMAGES, identifyBlobs } from '$lib/identify/client';
	import { MAX_FILES_PER_BATCH } from '$lib/photos/process';
	import { buildDrafts, requestCount, type Draft, type UploadMode } from '$lib/upload/drafts';
	import { analyzeDrafts, type DraftState } from '$lib/upload/queue';
	import { onDestroy } from 'svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let mode = $state<UploadMode>('each');
	let selected = $state<File[]>([]);
	let drafts = $state<Draft[]>([]);
	let states = $state<Record<string, DraftState>>({});
	let tooMany = $state(false);
	let duplicates = $state(0);
	let running = $state(false);
	let savedCount = $state(0);
	let inputKey = $state(0);
	let token = 0;
	let destroyed = false;

	onDestroy(() => {
		destroyed = true;
	});

	const idle = (id: string): DraftState => states[id] ?? { phase: 'idle' };
	const pending = $derived(drafts.filter((d) => idle(d.id).phase === 'idle'));
	const pendingRequests = $derived(requestCount(pending));
	const locked = $derived(savedCount > 0);
	const photosBeyondAnalysis = $derived(mode === 'one' && selected.length > IDENTIFY_MAX_IMAGES);

	// Changing the files or the mode only rebuilds the cards. It never sends anything.
	function rebuild() {
		token += 1;
		running = false;
		const plan = buildDrafts(selected, mode);
		drafts = plan.drafts;
		tooMany = plan.tooMany;
		duplicates = plan.duplicates;
		states = {};
	}

	function pickFiles(list: FileList | null) {
		selected = [...(list ?? [])];
		rebuild();
	}

	function setMode(next: UploadMode) {
		if (locked || next === mode) return;
		mode = next;
		rebuild();
	}

	async function run(list: Draft[]) {
		if (running || list.length === 0) return;
		const mine = token;
		running = true;
		await analyzeDrafts(
			list,
			(files) => identifyBlobs(files),
			(id, state) => {
				if (mine === token && !destroyed) states[id] = state;
			},
			() => mine !== token || destroyed
		);
		if (mine === token) running = false;
	}

	function reset() {
		selected = [];
		savedCount = 0;
		inputKey += 1;
		rebuild();
	}
</script>

<svelte:head><title>Качи растение · Флора</title></svelte:head>

<p class="back"><a href="/">← Каталог</a></p>
<h1>Качи растение</h1>

<div class="modes" role="group" aria-label="Как да се броят снимките">
	<button type="button" class="mode" aria-pressed={mode === 'each'} disabled={locked} onclick={() => setMode('each')}>
		Всяка снимка е отделно растение
	</button>
	<button type="button" class="mode" aria-pressed={mode === 'one'} disabled={locked} onclick={() => setMode('one')}>
		Всички снимки са едно растение
	</button>
</div>

{#key inputKey}
	<div class="picker">
		<label for="files">Снимки от устройството (най-много {MAX_FILES_PER_BATCH})</label>
		<input id="files" type="file" accept="image/*" multiple disabled={locked} onchange={(e) => pickFiles(e.currentTarget.files)} />
	</div>
{/key}
{#if tooMany}<p class="field-error">Най-много {MAX_FILES_PER_BATCH} снимки наведнъж; останалите са пропуснати.</p>{/if}
{#if duplicates > 0}<p class="muted">Повтарящи се снимки, махнати от избора: {duplicates}.</p>{/if}
{#if photosBeyondAnalysis}
	<p class="muted">Към Pl@ntNet ще отидат първите {IDENTIFY_MAX_IMAGES} снимки; всички се качват в растението.</p>
{/if}

{#if drafts.length > 0}
	<section class="confirm" aria-label="Анализ">
		{#if pendingRequests > 0}
			<p>
				Ще се изпратят <strong>{pendingRequests}</strong>
				{pendingRequests === 1 ? 'заявка' : 'заявки'} към Pl@ntNet — по една на растение. Дневният лимит е 100 за всички анализи;
				неуспешна заявка също се брои.
			</p>
			<button type="button" class="primary" disabled={running} onclick={() => run(pending)}>
				{running ? 'Анализира се…' : `Анализирай (${pendingRequests} ${pendingRequests === 1 ? 'заявка' : 'заявки'})`}
			</button>
		{:else if running}
			<p role="status">Анализира се…</p>
		{:else}
			<p class="muted">Нищо не е записано автоматично. Избери предложение, провери го и запази всяко растение отделно.</p>
		{/if}
	</section>

	<div class="cards">
		{#each drafts as draft, i (draft.id)}
			<UploadDraftCard
				index={i}
				plantId={draft.id}
				ownerId={data.user?.id ?? ''}
				files={draft.files}
				analysis={idle(draft.id)}
				catalog={data.catalog}
				busy={running}
				onanalyze={() => run([draft])}
				onsaved={() => (savedCount += 1)}
			/>
		{/each}
	</div>

	{#if locked}
		<p><button type="button" onclick={reset} disabled={running}>Качи още растения</button></p>
	{/if}
{/if}

<style>
	.back { margin: 0 0 var(--space-3); }
	.back a { display: inline-flex; align-items: center; min-height: 44px; text-decoration: none; }
	.back a:hover { text-decoration: underline; }
	.modes { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-bottom: var(--space-3); }
	.mode { min-height: 44px; }
	.mode[aria-pressed='true'] { border-color: var(--accent); outline: 2px solid var(--accent); font-weight: 600; }
	.picker { display: flex; flex-direction: column; gap: var(--space-1); margin-bottom: var(--space-3); }
	.picker label { font-weight: 500; font-size: var(--text-sm); color: var(--muted); }
	.picker input { min-height: 44px; }
	.confirm { margin: var(--space-3) 0; display: flex; flex-direction: column; gap: var(--space-2); align-items: flex-start; }
	.confirm p { margin: 0; }
	.cards { display: grid; gap: var(--space-3); grid-template-columns: 1fr; }
	@media (min-width: 900px) { .cards { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
