<script lang="ts">
	type GalleryPhoto = { id: string; url: string | null; thumbUrl: string | null; width: number; height: number };
	let { photos, alt }: { photos: GalleryPhoto[]; alt: string } = $props();

	let dialog = $state<HTMLDialogElement>();
	let index = $state(0);
	let isOpen = $state(false);
	let failed = $state<Record<string, boolean>>({});
	const current = $derived(photos[index]);

	function open(i: number) {
		index = i;
		isOpen = true;
		dialog?.showModal();
	}
	function step(delta: number) {
		index = (index + delta + photos.length) % photos.length;
	}
	function onkeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowRight') step(1);
		else if (event.key === 'ArrowLeft') step(-1);
	}
</script>

<ul class="thumbs">
	{#each photos as photo, i (photo.id)}
		<li>
			<button type="button" class="thumb" onclick={() => open(i)} aria-label={`Отвори снимка ${i + 1} от ${photos.length}`}>
				{#if photo.thumbUrl && !failed[`${photo.id}:thumb`]}
					<img
						src={photo.thumbUrl}
						alt={`${alt} — снимка ${i + 1}`}
						width={photo.width}
						height={photo.height}
						loading="lazy"
						onerror={() => (failed[`${photo.id}:thumb`] = true)}
					/>
				{:else}
					<span class="muted">Снимката липсва</span>
				{/if}
			</button>
		</li>
	{/each}
</ul>

<dialog bind:this={dialog} class="viewer" aria-label="Снимка на цял екран" {onkeydown} onclose={() => (isOpen = false)}>
	{#if isOpen && current}
		{#if current.url && !failed[`${current.id}:full`]}
			<img
				src={current.url}
				alt={`${alt} — снимка ${index + 1}`}
				onerror={() => (failed[`${current.id}:full`] = true)}
			/>
		{:else}
			<p>Снимката липсва.</p>
		{/if}
		<div class="controls">
			{#if photos.length > 1}
				<button type="button" onclick={() => step(-1)} aria-label="Предишна">‹</button>
				<span>{index + 1} / {photos.length}</span>
				<button type="button" onclick={() => step(1)} aria-label="Следваща">›</button>
			{/if}
			<button type="button" onclick={() => dialog?.close()}>Затвори</button>
		</div>
	{/if}
</dialog>

<style>
	.thumbs { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.5rem; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); }
	.thumb { padding: 0; width: 100%; aspect-ratio: 1; overflow: hidden; border-radius: 8px; }
	.thumb img { width: 100%; height: 100%; object-fit: cover; }
	.viewer { width: 100vw; height: 100dvh; max-width: none; max-height: none; margin: 0; padding: 0; border: none; background: #000; color: #fff; overscroll-behavior: contain; }
	.viewer::backdrop { background: #000; }
	.viewer img { width: 100%; height: calc(100dvh - 64px - env(safe-area-inset-bottom)); object-fit: contain; }
	.controls { box-sizing: content-box; height: 64px; padding-bottom: env(safe-area-inset-bottom); display: flex; align-items: center; justify-content: center; gap: 1rem; }
	.controls button { background: #222; color: #fff; border-color: #444; }
</style>
