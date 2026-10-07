<script lang="ts">
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import PhotoUploader from '$lib/components/PhotoUploader.svelte';
	import type { Candidate } from '$lib/identify/types';
	import type { DraftState } from '$lib/upload/queue';
	import { findExisting } from '$lib/upload/names';

	type Props = {
		index: number;
		plantId: string;
		ownerId: string;
		files: File[];
		analysis: DraftState;
		catalog: { id: string; scientific_name: string }[];
		busy: boolean;
		onanalyze: () => void;
		canAnalyze: boolean;
		onsaved: (scientificName: string) => void;
		onsettled: () => void;
	};
	let { index, plantId, ownerId, files, analysis, catalog, busy, canAnalyze, onanalyze, onsaved, onsettled }: Props = $props();

	let nameBg = $state('');
	let scientific = $state('');
	let family = $state('');
	let pickedIndex = $state<number | null>(null);
	let saving = $state(false);
	let message = $state('');
	let errors = $state<Record<string, string>>({});
	let savedId = $state<string | null>(null);
	let photoFailures = $state(0);
	let photosDone = $state(false);

	let previews = $state<{ file: File; url: string }[]>([]);
	$effect(() => {
		const made = files.map((file) => ({ file, url: URL.createObjectURL(file) }));
		previews = made;
		return () => made.forEach((p) => URL.revokeObjectURL(p.url));
	});

	const sent = $derived(analysis.phase === 'ok' ? analysis.sent : 0);
	const candidates = $derived<Candidate[]>(analysis.phase === 'ok' ? analysis.candidates : []);
	const existing = $derived(findExisting(scientific, catalog));
	const retryable = $derived(
		analysis.phase === 'error' && (analysis.code === 'upstream' || analysis.code === 'bad_request')
	);

	// A new result for this card replaces any earlier pick.
	$effect(() => {
		void analysis;
		untrack(() => (pickedIndex = null));
	});

	function pick(candidate: Candidate, i: number) {
		scientific = candidate.scientific_name;
		if (candidate.family) family = candidate.family;
		pickedIndex = i;
	}

	const identificationJson = $derived(
		analysis.phase === 'ok' && analysis.candidates.length > 0
			? JSON.stringify({
					modelVersion: analysis.result.modelVersion,
					photoCount: sent,
					candidates: analysis.candidates,
					chosenIndex: pickedIndex
				})
			: ''
	);

	const pct = (score: number) => `${Math.round(score * 100)} %`;
</script>

<section class="card" aria-label={`Растение ${index + 1}`}>
	<h2>Растение {index + 1}</h2>
	<ul class="thumbs">
		{#each previews as preview (preview.url)}
			<li><img src={preview.url} alt={`Снимка ${preview.file.name}`} decoding="async" /></li>
		{/each}
	</ul>

	{#if !savedId}
		<div class="ai" role="status" aria-live="polite">
			{#if analysis.phase === 'idle'}
				<p class="muted">Още не е анализирано.</p>
			{:else if analysis.phase === 'loading'}
				<p><span class="spinner" aria-hidden="true"></span> Разпознаване…</p>
			{:else if analysis.phase === 'skipped'}
				<p class="muted">Не е изпратено, защото по-рано заявката спря.</p>
				{#if canAnalyze}
					<button type="button" disabled={busy} onclick={onanalyze}>Анализирай само това (1 заявка)</button>
				{/if}
			{:else if analysis.phase === 'error'}
				<p class="error">{analysis.message}</p>
				{#if retryable}
					<button type="button" disabled={busy} onclick={onanalyze}>Опитай пак (1 заявка)</button>
				{/if}
			{:else}
				<p class="muted">AI предложения — не са потвърден вид. Избери и провери сам.</p>
				<ul class="candidates">
					{#each candidates as candidate, i (i)}
						<li>
							<button type="button" class="candidate" aria-pressed={pickedIndex === i} onclick={() => pick(candidate, i)}>
								<span class="mark" aria-hidden="true"></span>
								<span class="name"><em>{candidate.scientific_name}</em></span>
								<span class="score">{pct(candidate.score)}</span>
								{#if candidate.family || candidate.common_names.length > 0}
									<span class="meta">{[candidate.family, candidate.common_names.slice(0, 2).join(', ')].filter(Boolean).join(' · ')}</span>
								{/if}
							</button>
						</li>
					{/each}
				</ul>
				<p class="muted attribution">Разпознаването използва Pl@ntNet API.</p>
			{/if}
		</div>

		<form
			method="POST"
			action="/plants/new"
			class="stack"
			use:enhance={() => {
				saving = true;
				message = '';
				errors = {};
				return async ({ result }) => {
					saving = false;
					if (result.type === 'success' && result.data?.created) {
						savedId = String(result.data.id);
						onsaved(scientific.trim());
					} else if (result.type === 'failure') {
						message = String(result.data?.message ?? '');
						errors = (result.data?.errors as Record<string, string> | undefined) ?? {};
					} else {
						message = 'Растението не можа да се запази или отговорът не стигна. Провери в каталога, преди да опиташ пак.';
					}
				};
			}}
		>
			<input type="hidden" name="id" value={plantId} />
			<input type="hidden" name="identification" value={identificationJson} />
			<div class="field">
				<label for={`bg-${plantId}`}>Българско име *</label>
				<input id={`bg-${plantId}`} name="name_bg" maxlength="200" required autocomplete="off" bind:value={nameBg} aria-invalid={errors.name_bg ? 'true' : undefined} />
				{#if errors.name_bg}<p class="field-error">{errors.name_bg}</p>{/if}
			</div>
			<div class="field">
				<label for={`sci-${plantId}`}>Латинско име *</label>
				<input id={`sci-${plantId}`} name="scientific_name" maxlength="200" required autocomplete="off" bind:value={scientific} aria-invalid={errors.scientific_name ? 'true' : undefined} />
				{#if errors.scientific_name}<p class="field-error">{errors.scientific_name}</p>{/if}
				{#if existing}
					<p class="notice">
						Вече има растение с това латинско име: <a href={`/plants/${existing.id}`}>виж го</a>. Запазването пак е възможно.
					</p>
				{/if}
			</div>
			<div class="field">
				<label for={`fam-${plantId}`}>Семейство</label>
				<input id={`fam-${plantId}`} name="family" maxlength="100" autocomplete="off" bind:value={family} />
			</div>
			{#if message}<p class="error" role="alert">{message}</p>{/if}
			<button type="submit" class="primary" disabled={saving}>{saving ? 'Записване…' : 'Запази растението'}</button>
		</form>
	{:else}
		<p role="status">Растението е записано.</p>
		<PhotoUploader
			{plantId}
			{ownerId}
			initialFiles={files}
			showPicker={false}
			onsettled={(summary) => {
				photoFailures = summary.failed;
				photosDone = true;
				onsettled();
			}}
		/>
		{#if photosDone}
			<p>
				<a class="button" href={`/plants/${savedId}`}>Към растението</a>
				{#if photoFailures > 0}<span class="error"> {photoFailures} снимки не се качиха — опитай от страницата на растението.</span>{/if}
			</p>
		{/if}
	{/if}
</section>

<style>
	.card { border: 1px solid var(--border); border-radius: var(--radius-md, 10px); background: var(--surface); padding: var(--space-3); display: flex; flex-direction: column; gap: var(--space-3); }
	h2 { margin: 0; font-size: var(--text-lg, 1.125rem); }
	.thumbs { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: var(--space-2); }
	.thumbs img { width: 72px; height: 72px; object-fit: cover; border-radius: var(--radius-sm); display: block; }
	.ai { font-size: var(--text-sm); }
	.ai p { margin: 0 0 var(--space-2); }
	.candidates { list-style: none; margin: 0 0 var(--space-2); padding: 0; display: flex; flex-direction: column; gap: var(--space-2); }
	.candidate { width: 100%; min-height: 44px; display: grid; grid-template-columns: auto 1fr auto; gap: var(--space-1) var(--space-2); align-items: center; text-align: left; }
	.candidate[aria-pressed='true'] { border-color: var(--accent); outline: 2px solid var(--accent); }
	.mark { width: 0.9rem; height: 0.9rem; border-radius: 50%; border: 2px solid currentColor; }
	.candidate[aria-pressed='true'] .mark { background: var(--accent); border-color: var(--accent); }
	.meta { grid-column: 2 / -1; color: var(--muted); font-size: var(--text-xs); }
	.notice { margin: var(--space-1) 0 0; font-size: var(--text-sm); color: var(--muted); }
	.spinner { display: inline-block; width: 1rem; height: 1rem; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.8s linear infinite; vertical-align: -0.15em; }
	@keyframes spin { to { transform: rotate(360deg); } }
	@media (prefers-reduced-motion: reduce) { .spinner { animation: none; } }
</style>
