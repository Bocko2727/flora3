<script lang="ts">
	import { untrack } from 'svelte';
	import { identifyBlobs, latestOnly } from '$lib/identify/client';
	import { fail, type Candidate, type IdentifyOk } from '$lib/identify/types';

	type Props = {
		sources: Blob[];
		runKey: number;
		onpick: (candidate: Candidate, index: number) => void;
		/** `sent` = images that actually reached the API (failed conversions are not counted). */
		onresult: (result: IdentifyOk | null, sent: number) => void;
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

	const identify = latestOnly((blobs: Blob[]) => identifyBlobs(blobs));

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
		candidates = [];
		errorCode = null;
		errorMessage = '';
		onresult(null, 0);
		if (sources.length === 0) {
			// Selection cleared: drop old suggestions, no request.
			phase = 'idle';
			void identify([]); // marks any request still in flight as stale
			return;
		}
		phase = 'loading';
		const { stale, value: outcome } = await identify([...sources]);
		if (stale) return;
		const value = outcome.result;
		if (value.ok && value.candidates.length > 0) {
			candidates = value.candidates;
			phase = 'ok';
			onresult(value, outcome.sent);
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

<section class="ai" class:box={phase !== 'idle'} aria-label="AI предложения">
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
						<span class="mark" aria-hidden="true"></span>
						<span class="name"><em>{candidate.scientific_name}</em></span>
						<span class="score">{pct(candidate.score)}</span>
						{#if candidate.family || candidate.common_names.length > 0}
							<span class="meta">{[candidate.family, candidate.common_names.slice(0, 2).join(', ')].filter(Boolean).join(' · ')}</span>
						{/if}
						<span class="meter" aria-hidden="true"><b style:width={`${Math.round(candidate.score * 100)}%`}></b></span>
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
	.ai.box { margin: var(--space-3) 0; }
	.status { display: flex; align-items: center; gap: var(--space-2); min-height: 0; font-size: var(--text-sm); color: var(--muted); }
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
	.candidates { list-style: none; padding: 0; margin: var(--space-3) 0; display: flex; flex-direction: column; gap: var(--space-2); }
	.candidate {
		width: 100%;
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		gap: 2px var(--space-3);
		padding: var(--space-3);
		text-align: left;
		align-items: center;
		background: var(--surface-2);
		border-color: var(--border);
	}
	.candidate[aria-pressed='true'] { border-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent); }
	/* Picked state also changes shape: an empty ring becomes a filled dot. */
	.mark { width: 1rem; height: 1rem; border-radius: 50%; border: 1.5px solid var(--line-strong); grid-row: 1 / span 2; }
	.candidate[aria-pressed='true'] .mark { border-color: var(--accent); background: radial-gradient(var(--accent) 45%, transparent 50%); }
	.name { font-size: var(--text-base); line-height: 1.25; overflow-wrap: anywhere; }
	.score { font-weight: 600; font-variant-numeric: tabular-nums; font-size: var(--text-sm); }
	.meta { grid-column: 2 / -1; color: var(--muted); font-size: var(--text-sm); font-weight: 400; }
	.meter { grid-column: 2 / -1; height: 3px; margin-top: var(--space-1); border-radius: 2px; background: var(--border); overflow: hidden; }
	.meter b { display: block; height: 100%; background: var(--accent); }
	.attribution { margin: 0; font-size: var(--text-xs); }
</style>
