<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { UserFacingError } from '$lib/errors';
	import { deletePhoto, setPrimaryPhoto } from '$lib/photos/storage';
	import { getBrowserSupabase } from '$lib/supabase/browser';

	type ManagedPhoto = { id: string; path: string; thumbPath: string; thumbUrl: string | null; isPrimary: boolean };
	let { photos }: { photos: ManagedPhoto[] } = $props();

	let busyId = $state<string | null>(null);
	let confirmingId = $state<string | null>(null);
	let message = $state('');

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
</script>

{#if message}<p class="error" role="alert">{message}</p>{/if}

{#if photos.length === 0}
	<p class="muted">Няма снимки.</p>
{:else}
	<ul class="photos">
		{#each photos as photo, i (photo.id)}
			<li>
				{#if photo.thumbUrl}
					<img src={photo.thumbUrl} alt={`Снимка ${i + 1}`} loading="lazy" />
				{:else}
					<span class="muted missing">Снимката липсва</span>
				{/if}
				<div class="tools">
					{#if photo.isPrimary}
						<span class="badge confirmed">Основна</span>
					{:else}
						<button
							type="button"
							disabled={busyId !== null}
							onclick={() => act(photo.id, () => setPrimaryPhoto(getBrowserSupabase(), photo.id))}
						>
							Направи основна
						</button>
					{/if}
					{#if confirmingId === photo.id}
						<button
							type="button"
							class="danger"
							disabled={busyId !== null}
							onclick={() =>
								act(photo.id, () =>
									deletePhoto(getBrowserSupabase(), { id: photo.id, path: photo.path, thumb_path: photo.thumbPath })
								)}
						>
							Потвърди изтриването
						</button>
						<button type="button" onclick={() => (confirmingId = null)}>Отказ</button>
					{:else}
						<button type="button" disabled={busyId !== null} onclick={() => (confirmingId = photo.id)}>Изтрий</button>
					{/if}
				</div>
			</li>
		{/each}
	</ul>
{/if}

<style>
	.photos { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.75rem; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); }
	.photos li { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
	.photos img { width: 100%; aspect-ratio: 1; object-fit: cover; }
	.missing { display: grid; place-items: center; aspect-ratio: 1; }
	.tools { display: flex; flex-direction: column; gap: 0.35rem; padding: 0.5rem; align-items: stretch; }
	.tools .badge { align-self: flex-start; }
</style>
