<script lang="ts">
	type GalleryPhoto = {
		id: string;
		url: string | null;
		thumbUrl: string | null;
		/** Display-only enhanced copy (levels + light sharpening); the original stays the default. */
		enhancedUrl?: string | null;
		width: number;
		height: number;
	};
	/** Thumbnails start at `from`; earlier photos (the primary one) are opened by the page through `open`. */
	let { photos, alt, from = 0 }: { photos: GalleryPhoto[]; alt: string; from?: number } = $props();

	let dialog = $state<HTMLDialogElement>();
	let index = $state(0);
	let isOpen = $state(false);
	let failed = $state<Record<string, boolean>>({});
	let showEnhanced = $state<Record<string, boolean>>({});
	const current = $derived(photos[index]);
	const enhancedShown = $derived(Boolean(current && current.enhancedUrl && showEnhanced[current.id]));
	const shownUrl = $derived(enhancedShown ? current?.enhancedUrl : current?.url);

	export function open(i: number) {
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

{#if photos.length > from}
	<ul class="thumbs">
		{#each photos.slice(from) as photo, k (photo.id)}
			{@const i = from + k}
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
{/if}

<dialog bind:this={dialog} class="viewer" aria-label="Снимка на цял екран" {onkeydown} onclose={() => (isOpen = false)}>
	{#if isOpen && current}
		{#if shownUrl && !failed[`${current.id}:${enhancedShown ? 'enh' : 'full'}`]}
			<img
				src={shownUrl}
				alt={`${alt} — снимка ${index + 1}${enhancedShown ? ' (подобрено копие)' : ''}`}
				onerror={() => (failed[`${current.id}:${enhancedShown ? 'enh' : 'full'}`] = true)}
			/>
		{:else}
			<p>Снимката липсва.</p>
		{/if}
		<div class="controls">
			{#if current.enhancedUrl}
				<div class="versions" role="group" aria-label="Коя версия да се показва">
					<button type="button" aria-pressed={!enhancedShown} onclick={() => (showEnhanced[current.id] = false)}>Оригинал</button>
					<button type="button" aria-pressed={enhancedShown} onclick={() => (showEnhanced[current.id] = true)}>Подобрено копие</button>
				</div>
			{/if}
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
	.thumbs { list-style: none; padding: 0; margin: 0; display: grid; gap: var(--space-2); grid-template-columns: repeat(auto-fill, minmax(88px, 1fr)); }
	.thumb { padding: 0; width: 100%; aspect-ratio: 1; overflow: hidden; border-radius: var(--radius-sm); border-color: var(--border); background: var(--surface); }
	.thumb .muted { font-size: var(--text-xs); padding: var(--space-1); text-align: center; }
	.thumb img { width: 100%; height: 100%; object-fit: cover; }
	.viewer { width: 100vw; height: 100dvh; max-width: none; max-height: none; margin: 0; padding: 0; border: none; background: #000; color: #fff; overscroll-behavior: contain; }
	.viewer::backdrop { background: #000; }
	.viewer img { width: 100%; height: calc(100dvh - 64px - env(safe-area-inset-bottom)); object-fit: contain; }
	.controls { box-sizing: content-box; height: 64px; font-variant-numeric: tabular-nums; padding-bottom: env(safe-area-inset-bottom); display: flex; align-items: center; justify-content: center; gap: 1rem; }
	.controls { flex-wrap: wrap; }
	.controls button { background: #222; color: #fff; border-color: #444; }
	.versions { display: flex; gap: 0.25rem; }
	.versions button[aria-pressed='true'] { border-color: #fff; outline: 2px solid #fff; font-weight: 600; }
</style>
