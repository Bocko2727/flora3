<script lang="ts">
	import UploadDraftCard from '$lib/components/UploadDraftCard.svelte';
	import { IDENTIFY_MAX_IMAGES, identifyBlobs } from '$lib/identify/client';
	import { MAX_FILES_PER_BATCH } from '$lib/photos/process';
	import { buildDrafts, keepIds, mergeSelection, requestCount, type Draft, type UploadMode } from '$lib/upload/drafts';
	import { analyzeDrafts, type DraftState } from '$lib/upload/queue';
	import { onDestroy, untrack } from 'svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let mode = $state<UploadMode>('each');
	let selected = $state<File[]>([]);
	let drafts = $state<Draft[]>([]);
	let states = $state<Record<string, DraftState>>({});
	let tooMany = $state(false);
	let duplicates = $state(0);
	let running = $state(false);
	let saved = $state<Record<string, boolean>>({});
	let settled = $state<Record<string, boolean>>({});
	let catalog = $state(untrack(() => [...data.catalog]));
	let inputKey = $state(0);
	let token = 0;
	let destroyed = false;

	onDestroy(() => {
		destroyed = true;
	});

	const idle = (id: string): DraftState => states[id] ?? { phase: 'idle' };
	// A saved plant never goes back into the queue: its AI panel is gone and every request spends quota.
	const pending = $derived(drafts.filter((d) => idle(d.id).phase === 'idle' && !saved[d.id]));
	const pendingRequests = $derived(requestCount(pending));
	const savedCount = $derived(Object.keys(saved).length);
	const uploading = $derived(Object.keys(saved).some((id) => !settled[id]));
	// After the first analysis or save the choice is frozen: rebuilding would throw away paid results and typed names.
	const started = $derived(Object.keys(states).length > 0 || savedCount > 0);
	const frozen = $derived(started || running);
	const stoppedForGood = $derived(
		Object.values(states).some(
			(s) => s.phase === 'error' && (s.code === 'quota' || s.code === 'forbidden' || s.code === 'not_configured')
		)
	);
	const hasSuggestions = $derived(Object.values(states).some((s) => s.phase === 'ok'));
	const photosBeyondAnalysis = $derived(mode === 'one' && selected.length > IDENTIFY_MAX_IMAGES);

	// Changing the files or the mode only rebuilds the cards. It never sends anything.
	function rebuild(keep = false) {
		token += 1;
		running = false;
		const plan = buildDrafts(selected, mode);
		drafts = keep ? keepIds(drafts, plan.drafts, mode) : plan.drafts;
		tooMany = plan.tooMany;
		duplicates = plan.duplicates;
		states = {};
	}

	function pickFiles(list: FileList | null) {
		// A cancelled file dialog on a phone gives an empty list; that must not wipe the choice.
		if (!list || list.length === 0 || frozen) return;
		selected = mergeSelection(selected, [...list]);
		rebuild(true);
	}

	// "Снимай сега": each picture from the camera is added to the choice; nothing is sent.
	function addPicture(list: FileList | null) {
		if (!list || list.length === 0 || frozen) return;
		selected = mergeSelection(selected, [...list]);
		rebuild(true);
	}

	function clearChoice() {
		if (frozen) return;
		selected = [];
		inputKey += 1;
		rebuild();
	}

	function setMode(next: UploadMode) {
		if (frozen || next === mode) return;
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
		saved = {};
		settled = {};
		catalog = [...data.catalog];
		inputKey += 1;
		rebuild();
	}
</script>

<svelte:head><title>Качи растение · Флора</title></svelte:head>

<p class="back"><a href="/">← Каталог</a></p>
<h1>Качи растение</h1>

<div class="modes" role="group" aria-label="Как да се броят снимките">
	<button type="button" class="mode" aria-pressed={mode === 'each'} disabled={frozen} onclick={() => setMode('each')}>
		Всяка снимка е отделно растение
	</button>
	<button type="button" class="mode" aria-pressed={mode === 'one'} disabled={frozen} onclick={() => setMode('one')}>
		Всички снимки са едно растение
	</button>
</div>

{#key inputKey}
	<div class="picker">
		<label for="files">Снимки от устройството — добавят се към избраните (най-много {MAX_FILES_PER_BATCH})</label>
		<input id="files" type="file" accept="image/*" multiple disabled={frozen} onchange={(e) => pickFiles(e.currentTarget.files)} />
	</div>
	{#if selected.length > 0 && !frozen}
		<p><button type="button" onclick={clearChoice}>Изчисти избора</button></p>
	{/if}
	<label class="button camera" class:disabled={frozen}>
		Снимай сега
		<input
			type="file"
			accept="image/*"
			capture="environment"
			disabled={frozen}
			onchange={(e) => {
				const input = e.currentTarget;
				addPicture(input.files);
				input.value = '';
			}}
		/>
	</label>
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
		{:else if hasSuggestions}
			<p class="muted">Нищо не е записано автоматично. Избери предложение, провери го и запази всяко растение отделно.</p>
		{:else}
			<p class="muted">Няма предложения. Попълни имената сам и запази всяко растение отделно; нищо не се записва автоматично.</p>
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
				catalog={catalog}
				canAnalyze={!stoppedForGood}
				busy={running}
				onanalyze={() => run([draft])}
				onsaved={(name) => {
					saved[draft.id] = true;
					catalog.push({ id: draft.id, scientific_name: name });
				}}
				onsettled={() => (settled[draft.id] = true)}
			/>
		{/each}
	</div>

	{#if started}
		<p>
			<button type="button" onclick={reset} disabled={running || uploading}>
				{savedCount > 0 ? 'Качи още растения' : 'Започни отначало'}
			</button>
		</p>
		{#if savedCount < drafts.length && savedCount > 0}
			<p class="muted">Незапазените карти и платените им предложения ще се изчистят.</p>
		{/if}
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
	.camera { position: relative; overflow: hidden; align-self: flex-start; margin-bottom: var(--space-3); min-height: 44px; }
	.camera:focus-within { outline: 3px solid var(--accent); outline-offset: 2px; }
	.camera input { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }
	.camera.disabled { opacity: 0.5; cursor: default; }
	.camera.disabled input { cursor: default; }
	.confirm { margin: var(--space-3) 0; display: flex; flex-direction: column; gap: var(--space-2); align-items: flex-start; }
	.confirm p { margin: 0; }
	.cards { display: grid; gap: var(--space-3); grid-template-columns: 1fr; }
	@media (min-width: 900px) { .cards { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
