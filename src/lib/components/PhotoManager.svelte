<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { UserFacingError } from '$lib/errors';
	import { ENHANCE_MAX_PHOTOS, enhanceImage } from '$lib/photos/enhance-browser';
	import { deletePhoto, removeEnhanced, saveEnhanced, setPrimaryPhoto } from '$lib/photos/storage';
	import { getBrowserSupabase } from '$lib/supabase/browser';

	type ManagedPhoto = {
		id: string;
		path: string;
		thumbPath: string;
		thumbUrl: string | null;
		url: string | null;
		enhancedUrl: string | null;
		isPrimary: boolean;
	};
	let { photos, enhancing = $bindable(false) }: { photos: ManagedPhoto[]; enhancing?: boolean } = $props();

	let busyId = $state<string | null>(null);
	let confirmingId = $state<string | null>(null);
	let message = $state('');
	let selected = $state<Record<string, boolean>>({});
	let progress = $state<Record<string, 'run' | 'done' | 'error'>>({});
	let split = $state<Record<string, number>>({});

	const selectedPhotos = $derived(photos.filter((photo) => selected[photo.id] && photo.url));
	const tooManySelected = $derived(selectedPhotos.length > ENHANCE_MAX_PHOTOS);

	async function act(id: string, action: () => Promise<void>) {
		busyId = id;
		message = '';
		try {
			await action();
			await invalidateAll();
		} catch (e) {
			if (e instanceof UserFacingError) message = e.message;
			else {
				console.error(e);
				message = 'Неочаквана грешка. Опитай пак.';
			}
		} finally {
			busyId = null;
			confirmingId = null;
		}
	}

	// Only the chosen photos, one at a time, in the browser. The original is read, never written:
	// the result goes to its own `_enh.jpg` key.
	async function enhanceSelected() {
		if (enhancing || busyId !== null || selectedPhotos.length === 0 || tooManySelected) return;
		enhancing = true;
		message = '';
		progress = {};
		let failed = 0;
		const chosen = [...selectedPhotos];
		for (const photo of chosen) {
			progress[photo.id] = 'run';
			try {
				const response = await fetch(photo.url!);
				if (!response.ok) throw new UserFacingError('Снимката не можа да се зареди.');
				const blob = await enhanceImage(await response.blob());
				await saveEnhanced(getBrowserSupabase(), photo.path, blob);
				progress[photo.id] = 'done';
			} catch (e) {
				progress[photo.id] = 'error';
				failed += 1;
				if (!(e instanceof UserFacingError)) console.error(e);
			}
		}
		selected = {};
		enhancing = false;
		if (failed > 0) message = `Не успяха ${failed} от ${chosen.length}. Оригиналите са непокътнати.`;
		await invalidateAll();
	}
</script>

{#if message}<p class="error" role="alert">{message}</p>{/if}

{#if photos.length === 0}
	<p class="muted">Няма снимки.</p>
{:else}
	<section class="enhancer" aria-label="Image Enhancer">
		<p class="muted">
			Image Enhancer изправя светлото и тъмното и леко изостря. Цветовете не се пипат, а оригиналът винаги остава.
			Избери снимките, които искаш (най-много {ENHANCE_MAX_PHOTOS}).
		</p>
		<button type="button" class="primary" disabled={enhancing || busyId !== null || selectedPhotos.length === 0 || tooManySelected} onclick={enhanceSelected}>
			{enhancing ? 'Подобрява се…' : `Подобри избраните (${selectedPhotos.length})`}
		</button>
		{#if tooManySelected}<p class="field-error">Най-много {ENHANCE_MAX_PHOTOS} снимки наведнъж.</p>{/if}
	</section>

	<ul class="photos">
		{#each photos as photo, i (photo.id)}
			<li>
				{#if photo.enhancedUrl && photo.url}
					<div class="compare" style:--p={`${split[photo.id] ?? 50}%`}>
						<img src={photo.url} alt={`Снимка ${i + 1}: оригинал`} loading="lazy" />
						<img class="after" src={photo.enhancedUrl} alt={`Снимка ${i + 1}: подобрено копие`} loading="lazy" />
						<span class="tag l">Оригинал</span>
						<span class="tag r">Подобрено</span>
						<input
							type="range"
							min="0"
							max="100"
							value={split[photo.id] ?? 50}
							aria-label={`Сравни оригинал и подобрено копие на снимка ${i + 1}`}
							oninput={(event) => (split[photo.id] = Number(event.currentTarget.value))}
						/>
					</div>
				{:else if photo.thumbUrl}
					<img src={photo.thumbUrl} alt={`Снимка ${i + 1}`} loading="lazy" />
				{:else}
					<span class="muted missing">Снимката липсва</span>
				{/if}
				<div class="tools">
					<label class="pick">
						<input type="checkbox" bind:checked={selected[photo.id]} disabled={enhancing || !photo.url} />
						<span>Избери за подобряване</span>
					</label>
					{#if progress[photo.id] === 'run'}<span class="muted" role="status">Подобрява се…</span>{/if}
					{#if progress[photo.id] === 'error'}<span class="error">Неуспешно. Оригиналът е непокътнат.</span>{/if}
					{#if photo.enhancedUrl}
						<button
							type="button"
							disabled={busyId !== null || enhancing}
							onclick={() => act(photo.id, () => removeEnhanced(getBrowserSupabase(), [photo.path]))}
						>
							Махни подобреното
						</button>
					{/if}
					{#if photo.isPrimary}
						<span class="badge confirmed">Основна</span>
					{:else}
						<button
							type="button"
							disabled={busyId !== null || enhancing}
							onclick={() => act(photo.id, () => setPrimaryPhoto(getBrowserSupabase(), photo.id))}
						>
							Направи основна
						</button>
					{/if}
					{#if confirmingId === photo.id}
						<button
							type="button"
							class="danger"
							disabled={busyId !== null || enhancing}
							onclick={() =>
								act(photo.id, () =>
									deletePhoto(getBrowserSupabase(), { id: photo.id, path: photo.path, thumb_path: photo.thumbPath })
								)}
						>
							Потвърди изтриването
						</button>
						<button type="button" onclick={() => (confirmingId = null)}>Отказ</button>
					{:else}
						<button type="button" disabled={busyId !== null || enhancing} onclick={() => (confirmingId = photo.id)}>Изтрий</button>
					{/if}
				</div>
			</li>
		{/each}
	</ul>
{/if}

<style>
	.enhancer { display: flex; flex-direction: column; gap: var(--space-2); align-items: flex-start; margin-bottom: var(--space-3); }
	.enhancer p { margin: 0; }
	.photos { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.75rem; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); }
	.photos li { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
	.photos img { width: 100%; aspect-ratio: 1; object-fit: cover; }
	.missing { display: grid; place-items: center; aspect-ratio: 1; }
	.tools { display: flex; flex-direction: column; gap: 0.35rem; padding: 0.5rem; align-items: stretch; }
	.tools .badge { align-self: flex-start; }
	.pick { display: flex; align-items: center; gap: var(--space-2); min-height: 44px; font-size: var(--text-sm); cursor: pointer; }
	.pick input { width: 1.25rem; height: 1.25rem; }
	.compare { position: relative; aspect-ratio: 1; }
	.compare img { position: absolute; inset: 0; width: 100%; height: 100%; }
	.compare .after { clip-path: inset(0 0 0 var(--p)); }
	.compare input[type='range'] { position: absolute; left: 0; right: 0; bottom: 0; width: 100%; min-height: 44px; margin: 0; opacity: 0.85; }
	.tag { position: absolute; top: 0.25rem; padding: 0.1rem 0.35rem; font-size: var(--text-xs); background: rgba(0, 0, 0, 0.7); color: #fff; border-radius: var(--radius-sm); }
	.tag.l { left: 0.25rem; }
	.tag.r { right: 0.25rem; }
</style>
