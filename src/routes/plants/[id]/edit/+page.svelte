<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { untrack } from 'svelte';
	import AiSuggestions from '$lib/components/AiSuggestions.svelte';
	import PhotoManager from '$lib/components/PhotoManager.svelte';
	import PhotoUploader from '$lib/components/PhotoUploader.svelte';
	import PlantForm from '$lib/components/PlantForm.svelte';
	import { IDENTIFY_MAX_IMAGES } from '$lib/identify/client';
	import type { Candidate, IdentifyOk } from '$lib/identify/types';
	import type { PlantFormValues } from '$lib/schemas/plant';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let saving = $state(false);
	let confirmDelete = $state(false);
	let deleting = $state(false);
	let lastAction = $state<'update' | 'delete' | null>(null);

	let values = $state<PlantFormValues>(untrack(() => ({ ...data.values })));
	let sources = $state<Blob[]>([]);
	let runKey = $state(0);
	let ident = $state<IdentifyOk | null>(null);
	let identPhotoCount = $state(0);
	let pickedIndex = $state<number | null>(null);
	let fetchingPhotos = $state(false);
	let loadFailed = $state(false);

	/** Newest photos first, up to the identify limit; the saved (full-size) version is downscaled in the browser. */
	async function identifyPhotos() {
		if (fetchingPhotos) return;
		fetchingPhotos = true;
		try {
			const newest = [...data.photos]
				.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
				.filter((photo) => photo.url)
				.slice(0, IDENTIFY_MAX_IMAGES);
			const blobs: Blob[] = [];
			for (const photo of newest) {
				try {
					const response = await fetch(photo.url!);
					if (!response.ok) throw new Error(`HTTP ${response.status}`);
					blobs.push(await response.blob());
				} catch (e) {
					console.warn('Снимка пропусната при разпознаване:', e);
				}
			}
			loadFailed = blobs.length === 0;
			if (loadFailed) return;
			sources = blobs;
			runKey += 1;
		} finally {
			fetchingPhotos = false;
		}
	}

	function pickCandidate(candidate: Candidate, index: number) {
		values.scientific_name = candidate.scientific_name;
		if (candidate.family) values.family = candidate.family;
		pickedIndex = index;
	}

	function receive(result: IdentifyOk | null, sent: number) {
		ident = result;
		identPhotoCount = sent;
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

<svelte:head><title>Редакция · {data.plant.name_bg} · Флора</title></svelte:head>

<p><a href={`/plants/${data.plant.id}`}>← Към растението</a></p>
<h1>Редакция: {data.plant.name_bg}</h1>

{#if data.photos.length > 0}
	<button type="button" disabled={fetchingPhotos} onclick={() => void identifyPhotos()}>
		{fetchingPhotos ? 'Зареждане на снимките…' : 'Разпознай по снимките'}
	</button>
	{#if loadFailed}<p class="field-error" role="alert">Снимките не можаха да се заредят. Опитай пак.</p>{/if}
{/if}
<AiSuggestions
	{sources}
	{runKey}
	onpick={pickCandidate}
	onresult={receive}
	{pickedIndex}
	onretry={() => void identifyPhotos()}
/>

<form
	method="POST"
	action="?/update"
	class="stack"
	use:enhance={() => {
		saving = true;
		lastAction = 'update';
		return async ({ update }) => {
			await update({ reset: false });
			saving = false;
		};
	}}
>
	<input type="hidden" name="identification" value={identificationJson} />
	<PlantForm initial={data.values} bind:values errors={form?.errors ?? {}} legacy={data.legacy} />
	{#if form?.message && lastAction !== 'delete'}<p class="error" role="alert">{form.message}</p>{/if}
	<div class="row">
		<button type="submit" class="primary" disabled={saving}>{saving ? 'Записване…' : 'Запази'}</button>
		<a class="button" href={`/plants/${data.plant.id}`}>Отказ</a>
	</div>
</form>

<section class="stack">
	<h2>Снимки</h2>
	<PhotoManager photos={data.photos} />
	<PhotoUploader
		plantId={data.plant.id}
		ownerId={data.user?.id ?? ''}
		onsettled={async (summary) => {
			await invalidateAll();
			if (summary.done >= 1) await identifyPhotos();
		}}
	/>
</section>

<section class="stack danger-zone">
	<h2>Изтриване</h2>
	{#if form?.message && lastAction === 'delete'}<p class="error" role="alert">{form.message}</p>{/if}
	{#if !confirmDelete}
		<button type="button" onclick={() => (confirmDelete = true)}>Изтрий растението</button>
	{:else}
		<form
			method="POST"
			action="?/delete"
			class="stack"
			use:enhance={() => {
				deleting = true;
				lastAction = 'delete';
				return async ({ update }) => {
					await update();
					deleting = false;
				};
			}}
		>
			<p>Сигурен ли си? Растението и всичките му снимки ще бъдат изтрити завинаги.</p>
			<div class="row">
				<button type="submit" class="danger" disabled={deleting}>{deleting ? 'Изтриване…' : 'Да, изтрий завинаги'}</button>
				<button type="button" disabled={deleting} onclick={() => (confirmDelete = false)}>Отказ</button>
			</div>
		</form>
	{/if}
</section>

<style>
	.row { display: flex; gap: 0.5rem; flex-wrap: wrap; }
	.danger-zone { margin-top: 2rem; border-top: 1px solid var(--border); padding-top: 1rem; }
</style>
