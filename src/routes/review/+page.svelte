<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import ReviewItem from '$lib/components/ReviewItem.svelte';
	import { identifyBlobs } from '$lib/identify/client';
	import { runPrepare, type PrepareStop } from '$lib/review/prepare';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const mismatches = $derived(data.items.filter((i) => i.kind.kind === 'mismatch' || i.kind.kind === 'weak'));
	const matches = $derived(data.items.filter((i) => i.kind.kind === 'match'));
	const none = $derived(data.items.filter((i) => i.kind.kind === 'none'));
	const withText = $derived(matches.filter((i) => i.wiki?.extract).length);

	let running = $state(false);
	let progress = $state({ done: 0, total: 0 });
	let outcome = $state<{ prepared: number; skipped: number; stoppedBy: PrepareStop } | null>(null);
	let controller: AbortController | null = null;
	let confirmAll = $state(false);
	let allBusy = $state(false);

	const STOP_TEXT: Record<PrepareStop, string> = {
		done: 'Готово.',
		quota: 'Лимитът за днес е изчерпан. Продължи утре — ще започне от там, докъдето е стигнало.',
		forbidden: 'Нямаш права или сесията е изтекла. Влез отново.',
		not_configured: 'AI разпознаването не е настроено.',
		aborted: 'Спряно. Продължи, когато решиш.'
	};

	async function prepare() {
		if (running) return;
		running = true;
		outcome = null;
		controller = new AbortController();
		progress = { done: 0, total: data.toPrepare.length };
		try {
			outcome = await runPrepare(data.toPrepare, {
				fetchPhoto: async (url) => {
					const response = await fetch(url);
					if (!response.ok) throw new Error(`HTTP ${response.status}`);
					return response.blob();
				},
				identify: (blobs) => identifyBlobs(blobs),
				save: (body) =>
					fetch('/api/review/prepare', {
						method: 'POST',
						headers: { 'content-type': 'application/json' },
						body: JSON.stringify(body)
					}),
				onProgress: (done, total) => (progress = { done, total }),
				signal: controller.signal
			});
		} finally {
			running = false;
			controller = null;
			await invalidateAll();
		}
	}
</script>

<svelte:head><title>За преглед · Флора</title></svelte:head>

<p class="back"><a href="/">← Каталог</a></p>
<h1>За преглед</h1>
<p class="muted">
	Старите растения минават през Pl@ntNet. Ти решаваш дали името съвпада. Нищо не се приема без теб.
</p>

<section class="box prep" aria-label="Подготовка">
	<p>
		За подготовка: <strong>{data.toPrepare.length}</strong> · За решение: <strong>{mismatches.length + matches.length}</strong> ·
		Решени: <strong>{data.decided}</strong>
	</p>
	{#if data.toPrepare.length > 0 || running}
		<div class="row">
			<button type="button" class="primary" disabled={running} onclick={() => void prepare()}>Подготви прегледа</button>
			{#if running}<button type="button" onclick={() => controller?.abort()}>Спри</button>{/if}
		</div>
	{/if}
	<div role="status" aria-live="polite">
		{#if running}
			<progress max={progress.total} value={progress.done}></progress>
			<span class="num">{progress.done} / {progress.total}</span>
		{:else if outcome}
			<p>{STOP_TEXT[outcome.stoppedBy]} Подготвени: {outcome.prepared}{#if outcome.skipped > 0}, пропуснати: {outcome.skipped} (ще се опитат пак){/if}.</p>
		{/if}
	</div>
	<p class="muted small-text">Разпознаване: Pl@ntNet API · Текст: Уикипедия, CC BY-SA 4.0</p>
</section>

{#if mismatches.length > 0}
	<h2>Не съвпадат <span class="muted">({mismatches.length})</span></h2>
	<div class="list">
		{#each mismatches as item (item.identId)}<ReviewItem {item} />{/each}
	</div>
{/if}

{#if matches.length > 0}
	<div class="group-head">
		<h2>Съвпадат <span class="muted">({matches.length})</span></h2>
		{#if !confirmAll}
			<button type="button" class="primary" onclick={() => (confirmAll = true)}>Приеми всички {matches.length} съвпадения</button>
		{:else}
			<form
				method="POST"
				action="?/matchAll"
				class="box confirm"
				use:enhance={() => {
					allBusy = true;
					return async ({ update }) => {
						await update();
						allBusy = false;
						confirmAll = false;
					};
				}}
			>
				{#each matches as item (item.identId)}<input type="hidden" name="identId" value={item.identId} />{/each}
				<p>{matches.length} растения ще се маркират като съвпадащи. Описания от Уикипедия ще се добавят на {withText} от тях. Имената не се сменят.</p>
				<div class="row">
					<button type="submit" class="primary" disabled={allBusy}>{allBusy ? 'Записване…' : 'Потвърди'}</button>
					<button type="button" disabled={allBusy} onclick={() => (confirmAll = false)}>Отказ</button>
				</div>
			</form>
		{/if}
	</div>
	<div class="list">
		{#each matches as item (item.identId)}<ReviewItem {item} />{/each}
	</div>
{/if}

{#if none.length > 0}
	<h2>Без резултат <span class="muted">({none.length})</span></h2>
	<div class="list">
		{#each none as item (item.identId)}<ReviewItem {item} />{/each}
	</div>
{/if}

{#if data.items.length === 0 && data.toPrepare.length === 0}
	<p class="muted">Няма нищо за преглед.</p>
{/if}

<style>
	.back a { display: inline-flex; align-items: center; min-height: 44px; }
	.prep { display: flex; flex-direction: column; gap: var(--space-2); margin-bottom: var(--space-4); }
	.prep p { margin: 0; }
	.row { display: flex; gap: var(--space-2); flex-wrap: wrap; }
	progress { width: 100%; height: 12px; }
	.list { display: flex; flex-direction: column; gap: var(--space-3); margin-bottom: var(--space-4); }
	.group-head { display: flex; flex-wrap: wrap; gap: var(--space-2); align-items: center; justify-content: space-between; }
	.confirm { display: flex; flex-direction: column; gap: var(--space-2); width: 100%; }
	.confirm p { margin: 0; }
	.small-text { font-size: var(--text-xs); }
	.num { font-variant-numeric: tabular-nums; }
</style>
