<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { untrack } from 'svelte';
	import AiSuggestions from '$lib/components/AiSuggestions.svelte';
	import PhotoUploader from '$lib/components/PhotoUploader.svelte';
	import PlantForm from '$lib/components/PlantForm.svelte';
	import { IDENTIFY_MAX_IMAGES } from '$lib/identify/client';
	import type { Candidate, IdentifyOk } from '$lib/identify/types';
	import { MAX_FILES_PER_BATCH } from '$lib/photos/process';
	import type { PlantFormValues } from '$lib/schemas/plant';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const empty = { scientific_name: '', name_bg: '', family: '', description: '', habitat: '', notes: '' };
	let values = $state<PlantFormValues>(untrack(() => ({ ...(form?.values ?? empty) })));
	let selected = $state<File[]>([]);
	let runKey = $state(0);
	let ident = $state<IdentifyOk | null>(null);
	let identPhotoCount = $state(1);
	let pickedIndex = $state<number | null>(null);
	let tooMany = $state(false);
	let submitting = $state(false);
	let createdId = $state<string | null>(null);
	let failed = $state(0);

	// Previews of the chosen files; each object URL is released when the selection changes or the page closes.
	let previews = $state<{ url: string; broken: boolean }[]>([]);
	$effect(() => {
		const urls = selected.map((file) => URL.createObjectURL(file));
		previews = urls.map((url) => ({ url, broken: false }));
		return () => urls.forEach((url) => URL.revokeObjectURL(url));
	});

	function pick(files: FileList | null) {
		const all = [...(files ?? [])];
		tooMany = all.length > MAX_FILES_PER_BATCH;
		selected = all.slice(0, MAX_FILES_PER_BATCH);
		if (selected.length > 0) runKey += 1;
	}

	function pickCandidate(candidate: Candidate, index: number) {
		values.scientific_name = candidate.scientific_name;
		if (candidate.family) values.family = candidate.family;
		pickedIndex = index;
	}

	function receive(result: IdentifyOk | null) {
		ident = result;
		identPhotoCount = Math.min(Math.max(selected.length, 1), IDENTIFY_MAX_IMAGES);
		if (!result) pickedIndex = null;
	}

	const identificationJson = $derived(
		ident && ident.candidates.length > 0
			? JSON.stringify({
					modelVersion: ident.modelVersion,
					photoCount: identPhotoCount,
					candidates: ident.candidates,
					chosenIndex: pickedIndex
				})
			: ''
	);
</script>

<svelte:head><title>Ново растение · Флора</title></svelte:head>

<p class="back"><a href="/">← Каталог</a></p>
<h1>Ново растение</h1>

{#if !createdId}
	<div class="photos">
		<label for="photos" class="photos-title">Снимки</label>
		<ul class="strip" class:empty={selected.length === 0}>
			{#each previews as preview, i (preview.url)}
				<li class="tile">
					{#if preview.broken}
						<span class="muted">Без преглед</span>
					{:else}
						<img src={preview.url} alt={`Избрана снимка ${i + 1}`} decoding="async" onerror={() => (preview.broken = true)} />
					{/if}
				</li>
			{/each}
			<li class="tile picker">
				<input id="photos" type="file" accept="image/*" multiple onchange={(event) => pick(event.currentTarget.files)} />
				<span aria-hidden="true">{selected.length === 0 ? '+ Добави снимки' : 'Смени'}</span>
			</li>
		</ul>
		{#if tooMany}<p class="field-error">Най-много {MAX_FILES_PER_BATCH} снимки наведнъж.</p>{/if}
		{#if selected.length > 0}<p class="muted count">Избрани снимки: {selected.length}</p>{/if}
	</div>
	<AiSuggestions sources={selected} {runKey} onpick={pickCandidate} onresult={receive} {pickedIndex} />
	<form
		method="POST"
		class="stack"
		use:enhance={() => {
			submitting = true;
			return async ({ result, update }) => {
				submitting = false;
				if (result.type === 'success' && result.data?.created) {
					createdId = String(result.data.id);
					if (selected.length === 0) await goto(`/plants/${createdId}`);
				} else {
					await update({ reset: false });
				}
			};
		}}
	>
		<input type="hidden" name="id" value={data.newId} />
		<input type="hidden" name="identification" value={identificationJson} />
		<PlantForm initial={form?.values ?? empty} bind:values errors={form?.errors ?? {}} />
		{#if form?.message}<p class="error" role="alert">{form.message}</p>{/if}
		<button type="submit" class="primary" disabled={submitting}>
			{submitting ? 'Записване…' : 'Запази растението'}
		</button>
	</form>
{:else}
	<p role="status">Растението е записано. Качване на снимките…</p>
	<PhotoUploader
		plantId={createdId}
		ownerId={data.user?.id ?? ''}
		initialFiles={selected}
		showPicker={false}
		onsettled={(summary) => {
			failed = summary.failed;
			if (summary.failed === 0) void goto(`/plants/${createdId}`);
		}}
	/>
	{#if failed > 0}
		<p><a class="button" href={`/plants/${createdId}`}>Към растението</a></p>
	{/if}
{/if}

<style>
	.back { margin: 0 0 var(--space-3); }
	.back a { display: inline-flex; align-items: center; min-height: 44px; text-decoration: none; }
	.back a:hover { text-decoration: underline; }
	.photos { display: flex; flex-direction: column; gap: var(--space-2); margin-bottom: var(--space-3); }
	.photos-title { font-weight: 500; font-size: var(--text-sm); color: var(--muted); }
	/* A 4:1 strip of square tiles; with nothing chosen the picker fills the whole strip. */
	.strip { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--space-2); }
	.tile {
		position: relative;
		aspect-ratio: 1;
		border-radius: var(--radius-sm);
		overflow: hidden;
		background: var(--surface);
		display: grid;
		place-items: center;
		text-align: center;
		font-size: var(--text-xs);
	}
	.tile img { width: 100%; height: 100%; object-fit: cover; }
	.picker { border: 1.5px dashed var(--line-strong); color: var(--muted); font-weight: 500; padding: var(--space-1); }
	.picker:hover { border-color: var(--muted); color: var(--text); }
	.picker:focus-within { outline: 3px solid var(--accent); outline-offset: 2px; }
	.picker input { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }
	.empty .picker { grid-column: 1 / -1; aspect-ratio: 4 / 1; font-size: var(--text-sm); }
	.count { margin: 0; font-size: var(--text-sm); }
</style>
