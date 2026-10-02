<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import PhotoUploader from '$lib/components/PhotoUploader.svelte';
	import PlantForm from '$lib/components/PlantForm.svelte';
	import { MAX_FILES_PER_BATCH } from '$lib/photos/process';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const empty = { scientific_name: '', name_bg: '', family: '', description: '', habitat: '', notes: '' };
	let selected = $state<File[]>([]);
	let tooMany = $state(false);
	let submitting = $state(false);
	let createdId = $state<string | null>(null);
	let failed = $state(0);

	function pick(files: FileList | null) {
		const all = [...(files ?? [])];
		tooMany = all.length > MAX_FILES_PER_BATCH;
		selected = all.slice(0, MAX_FILES_PER_BATCH);
	}
</script>

<svelte:head><title>Ново растение · Флора</title></svelte:head>

<p><a href="/">← Каталог</a></p>
<h1>Ново растение</h1>

{#if !createdId}
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
		<PlantForm initial={form?.values ?? empty} errors={form?.errors ?? {}} />
		<div class="field">
			<label for="photos">Снимки (по желание)</label>
			<input id="photos" type="file" accept="image/*" multiple onchange={(event) => pick(event.currentTarget.files)} />
			{#if tooMany}<p class="field-error">Най-много {MAX_FILES_PER_BATCH} снимки наведнъж.</p>{/if}
			{#if selected.length > 0}<p class="muted">Избрани снимки: {selected.length}</p>{/if}
		</div>
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
