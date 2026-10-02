<script lang="ts">
	import { untrack } from 'svelte';
	import { latestOnly, prepareImages, requestIdentification } from '$lib/identify/client';
	import { fail, type Candidate, type IdentifyOk, type IdentifyResult } from '$lib/identify/types';

	type Props = {
		sources: Blob[];
		runKey: number;
		onpick: (candidate: Candidate, index: number) => void;
		onresult: (result: IdentifyOk | null) => void;
		pickedIndex: number | null;
		/** Replaces the built-in retry when the parent has to rebuild `sources` first. */
		onretry?: () => void;
	};
	let { sources, runKey, onpick, onresult, pickedIndex, onretry }: Props = $props();

	type State = 'idle' | 'loading' | 'ok' | 'error';
	let phase = $state<State>('idle');
	let candidates = $state<Candidate[]>([]);
	let errorCode = $state<string | null>(null);
	let errorMessage = $state('');

	const identify = latestOnly(async (blobs: Blob[]): Promise<IdentifyResult> => {
		const images = await prepareImages(blobs);
		if (images.length === 0) return fail('bad_request');
		return requestIdentification(images);
	});

	const pct = (score: number) => `${Math.round(score * 100)} %`;
	const retryable = $derived(errorCode === 'upstream' || errorCode === 'bad_request');
	const statusText = $derived(
		phase === 'loading'
			? 'Разпознаване…'
			: phase === 'ok'
				? 'Предложения от AI. Избери и провери сам.'
				: phase === 'error'
					? errorMessage
					: ''
	);

	async function run() {
		phase = 'loading';
		candidates = [];
		errorCode = null;
		errorMessage = '';
		onresult(null);
		const { stale, value } = await identify([...sources]);
		if (stale) return;
		if (value.ok && value.candidates.length > 0) {
			candidates = value.candidates;
			phase = 'ok';
			onresult(value);
			return;
		}
		const failure = value.ok ? fail('no_match') : value;
		errorCode = failure.code;
		errorMessage = failure.message;
		phase = 'error';
	}

	let lastKey = 0;
	$effect(() => {
		const key = runKey;
		if (key <= 0 || key === lastKey) return;
		lastKey = key;
		untrack(() => void run());
	});
</script>

<section class="ai" aria-label="AI предложения">
	<div class="status" role="status" aria-live="polite">
		{#if phase === 'loading'}<span class="spinner" aria-hidden="true"></span>{/if}
		{#if statusText}<span class:error={phase === 'error'}>{statusText}</span>{/if}
	</div>

	{#if phase === 'ok'}
		<ul class="candidates">
			{#each candidates as candidate, index (index)}
				<li>
					<button
						type="button"
						class="candidate"
						aria-pressed={pickedIndex === index}
						onclick={() => onpick(candidate, index)}
					>
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
	{:else if phase === 'error' && retryable}
		<button type="button" onclick={() => (onretry ? onretry() : void run())}>Опитай пак</button>
	{/if}
</section>

<style>
	.status { display: flex; align-items: center; gap: 0.5rem; min-height: 0; }
	.status .error { color: var(--danger); }
	.spinner {
		width: 1rem;
		height: 1rem;
		border: 2px solid var(--border);
		border-top-color: var(--accent);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}
	@keyframes spin { to { transform: rotate(360deg); } }
	@media (prefers-reduced-motion: reduce) { .spinner { animation-duration: 3s; } }
	.candidates { list-style: none; padding: 0; margin: 0.5rem 0; display: flex; flex-direction: column; gap: 0.5rem; }
	.candidate {
		width: 100%;
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.125rem 0.5rem;
		text-align: left;
		align-items: center;
	}
	.candidate[aria-pressed='true'] { border-color: var(--accent); outline: 2px solid var(--accent); }
	.score { font-weight: 600; font-variant-numeric: tabular-nums; }
	.meta { grid-column: 1 / -1; color: var(--muted); font-size: 0.875rem; }
	.attribution { margin: 0; font-size: 0.875rem; }
</style>
