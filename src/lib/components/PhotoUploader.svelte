<script lang="ts">
	import { onMount } from 'svelte';
	import { UserFacingError } from '$lib/errors';
	import { MAX_FILES_PER_BATCH, processImage, validateInputFile } from '$lib/photos/process';
	import { DUPLICATE_PHOTO_MESSAGE, savePhoto } from '$lib/photos/storage';
	import { getBrowserSupabase } from '$lib/supabase/browser';

	type ItemStatus = 'waiting' | 'processing' | 'uploading' | 'done' | 'error';
	type Item = { key: string; photoId: string; file: File; status: ItemStatus; message: string; retryable: boolean };
	type Props = {
		plantId: string;
		ownerId: string;
		initialFiles?: File[];
		showPicker?: boolean;
		onsettled?: (summary: { done: number; failed: number }) => void;
	};

	let { plantId, ownerId, initialFiles = [], showPicker = true, onsettled }: Props = $props();

	const LABELS: Record<ItemStatus, string> = {
		waiting: 'Чака',
		processing: 'Обработва се…',
		uploading: 'Качва се…',
		done: 'Готово',
		error: 'Грешка'
	};

	let items = $state<Item[]>([]);
	let notice = $state('');
	let running = false;

	function enqueue(files: File[]) {
		notice = '';
		let batch = files;
		if (batch.length > MAX_FILES_PER_BATCH) {
			notice = `Най-много ${MAX_FILES_PER_BATCH} снимки наведнъж.`;
			batch = batch.slice(0, MAX_FILES_PER_BATCH);
		}
		for (const file of batch) {
			const invalid = validateInputFile(file);
			items.push({
				key: crypto.randomUUID(),
				photoId: crypto.randomUUID(),
				file,
				status: invalid ? 'error' : 'waiting',
				message: invalid ?? '',
				retryable: !invalid
			});
		}
		void run();
	}

	async function uploadOne(item: Item) {
		try {
			item.status = 'processing';
			item.message = '';
			const photo = await processImage(item.file);
			item.status = 'uploading';
			await savePhoto(getBrowserSupabase(), { ownerId, plantId, photoId: item.photoId, photo });
			item.status = 'done';
		} catch (e) {
			item.status = 'error';
			if (e instanceof UserFacingError) {
				item.message = e.message;
				item.retryable = e.message !== DUPLICATE_PHOTO_MESSAGE;
			} else {
				console.error(e);
				item.message = 'Неочаквана грешка. Опитай пак.';
			}
		}
	}

	async function run() {
		if (running) return;
		running = true;
		try {
			let next: Item | undefined;
			while ((next = items.find((item) => item.status === 'waiting'))) {
				await uploadOne(next);
			}
		} finally {
			running = false;
		}
		onsettled?.({
			done: items.filter((item) => item.status === 'done').length,
			failed: items.filter((item) => item.status === 'error').length
		});
	}

	function retry(item: Item) {
		item.status = 'waiting';
		item.message = '';
		void run();
	}

	onMount(() => {
		if (initialFiles.length > 0) enqueue(initialFiles);
	});
</script>

<div class="uploader stack">
	{#if showPicker}
		<label class="button picker">
			Добави снимки
			<input
				type="file"
				accept="image/*"
				multiple
				onchange={(event) => {
					const input = event.currentTarget;
					enqueue([...(input.files ?? [])]);
					input.value = '';
				}}
			/>
		</label>
	{/if}
	{#if notice}<p class="error" role="alert">{notice}</p>{/if}
	{#if items.length > 0}
		<ul class="queue" aria-live="polite">
			{#each items as item (item.key)}
				<li class={item.status}>
					<span class="file">{item.file.name}</span>
					<span class="state">{LABELS[item.status]}</span>
					{#if item.message}<span class="message">{item.message}</span>{/if}
					{#if item.status === 'error' && item.retryable}
						<button type="button" onclick={() => retry(item)}>Опитай пак</button>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.picker { position: relative; overflow: hidden; }
	.picker input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
	.queue { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.5rem; }
	.queue li {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.25rem 0.5rem;
		align-items: center;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 0.5rem 0.75rem;
	}
	.file { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.state { font-weight: 600; }
	.done .state { color: var(--accent); }
	.error .state, .message { color: var(--danger); }
	.message { grid-column: 1 / -1; font-size: 0.875rem; }
	.queue button { grid-column: 1 / -1; justify-self: start; }
</style>
