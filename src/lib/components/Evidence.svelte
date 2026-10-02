<script lang="ts">
	import { enhance } from '$app/forms';
	import { sameName, type Candidate } from '$lib/identify/types';
	import type { IdStatus, NameSource } from '$lib/status';

	type Props = {
		plant: {
			scientific_name: string;
			id_status: IdStatus;
			name_source: NameSource;
			gbif_match: string | null;
			gbif_accepted_name: string | null;
			gbif_key: number | null;
			gbif_accepted_key?: number | null;
			gbif_checked_at: string | null;
			inat_observation_id: number | null;
			inat_quality_grade: string | null;
			inat_taxon_name: string | null;
		};
		latest: {
			created_at: string;
			model_version: string | null;
			candidates: Candidate[];
			chosen_index: number | null;
		} | null;
		isEditor: boolean;
		message?: string;
	};
	let { plant, latest, isEditor, message = '' }: Props = $props();

	let busy = $state<'check' | 'accepted' | 'link' | 'unlink' | null>(null);

	const GRADES: Record<string, string> = { research: 'Research Grade', needs_id: 'Needs ID', casual: 'Casual' };
	const pct = (score: number) => `${Math.round(score * 100)}\u00a0%`;
	const day = (iso: string) => {
		const [y, m, d] = iso.slice(0, 10).split('-');
		return `${d}.${m}.${y}`;
	};

	const aiMatch = $derived(latest?.candidates.find((c) => sameName(c.scientific_name, plant.scientific_name)) ?? null);
	const topCandidate = $derived(
		latest?.candidates.reduce<Candidate | null>((best, c) => (best === null || c.score > best.score ? c : best), null) ?? null
	);
	const aiOther = $derived(
		topCandidate && topCandidate.score >= 0.3 && !sameName(topCandidate.scientific_name, plant.scientific_name)
			? topCandidate
			: null
	);
	const gbifKey = $derived(plant.gbif_accepted_key ?? plant.gbif_key);
	const synonymOf = $derived(plant.gbif_match === 'synonym' ? plant.gbif_accepted_name : null);
	const inatOther = $derived(
		plant.inat_quality_grade === 'research' &&
			plant.inat_taxon_name !== null &&
			!sameName(plant.inat_taxon_name, plant.gbif_accepted_name ?? plant.scientific_name)
	);

	function submit(kind: NonNullable<typeof busy>) {
		return () => {
			busy = kind;
			return async ({ update }: { update: (options?: { reset?: boolean }) => Promise<void> }) => {
				await update({ reset: kind === 'link' });
				busy = null;
			};
		};
	}
</script>

<section class="evidence box">
	<h2 class="eyebrow">Доказателства</h2>
	<dl>
		<dt>AI</dt>
		<dd>
			{#if !latest}
				няма
			{:else if aiMatch}
				Pl@ntNet · {pct(aiMatch.score)} · {day(latest.created_at)}
			{:else}
				Pl@ntNet не предлага това име
			{/if}
		</dd>

		<dt>Име</dt>
		<dd>
			{#if plant.gbif_match === null}
				Името не е проверено в GBIF.
			{:else if plant.gbif_match === 'accepted'}
				GBIF · прието
			{:else if plant.gbif_match === 'synonym'}
				GBIF · синоним{#if synonymOf}&nbsp;на <em>{synonymOf}</em>{/if}
			{:else if plant.gbif_match === 'doubtful'}
				GBIF · съмнително
			{:else}
				GBIF не намери точно това име
			{/if}
			{#if gbifKey && plant.gbif_match !== null && plant.gbif_match !== 'none'}
				<a href={`https://www.gbif.org/species/${gbifKey}`} rel="noreferrer">Виж в GBIF</a>
			{/if}
			{#if plant.gbif_checked_at}<span class="muted"> · проверено {day(plant.gbif_checked_at)}</span>{/if}
		</dd>

		<dt>Общност</dt>
		<dd>
			{#if plant.inat_observation_id === null}
				няма iNaturalist наблюдение
			{:else}
				{@const grade = GRADES[plant.inat_quality_grade ?? ''] ?? plant.inat_quality_grade}
				<a href={`https://www.inaturalist.org/observations/${plant.inat_observation_id}`} rel="noreferrer"
					>iNaturalist · {grade}{#if plant.inat_taxon_name}&nbsp;· <em>{plant.inat_taxon_name}</em>{/if}</a
				>
			{/if}
		</dd>
	</dl>

	{#if synonymOf}
		<div class="warning">
			<p>GBIF: синоним на <em>{synonymOf}</em></p>
			{#if isEditor}
				<form method="POST" action="?/useAccepted" use:enhance={submit('accepted')}>
					<button type="submit" disabled={busy !== null}>Смени на <em>{synonymOf}</em></button>
				</form>
			{/if}
		</div>
	{/if}
	{#if inatOther}
		<p class="warning">
			iNaturalist потвърждава <em>{plant.inat_taxon_name}</em>, а тук пише <em>{plant.scientific_name}</em>.
		</p>
	{/if}
	{#if aiOther}
		<p class="warning">AI предлага друг вид: <em>{aiOther.scientific_name}</em> ({pct(aiOther.score)}).</p>
	{/if}

	{#if isEditor}
		<div class="tools">
			<form method="POST" action="?/checkName" use:enhance={submit('check')}>
				<button type="submit" disabled={busy !== null}>
					{busy === 'check' ? 'Проверка…' : 'Провери името в GBIF'}
				</button>
			</form>

			<form method="POST" action="?/linkInat" class="inat" use:enhance={submit('link')}>
				<div class="field">
					<label for="inat-link">Линк към наблюдение в iNaturalist</label>
					<input id="inat-link" name="inat" type="text" inputmode="url" autocomplete="off" required />
				</div>
				<button type="submit" disabled={busy !== null}>{busy === 'link' ? 'Свързване…' : 'Свържи'}</button>
			</form>

			{#if plant.inat_observation_id !== null}
				<form method="POST" action="?/unlinkInat" use:enhance={submit('unlink')}>
					<button type="submit" disabled={busy !== null}>Премахни връзката</button>
				</form>
			{/if}
		</div>
		{#if message}<p class="error" role="alert">{message}</p>{/if}
	{/if}
</section>

<style>
	.evidence { margin-top: var(--space-4); }
	dl { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: var(--space-2) var(--space-4); margin: 0; font-size: var(--text-sm); }
	dt { color: var(--muted); }
	dd { margin: 0; overflow-wrap: anywhere; font-variant-numeric: tabular-nums; }
	dd a { display: inline-block; padding-block: 2px; }
	.warning { background: var(--warn-bg); color: var(--warn-text); padding: var(--space-2) var(--space-3); border-radius: var(--radius-sm); margin: var(--space-3) 0 0; font-size: var(--text-sm); }
	.warning p { margin: 0 0 var(--space-2); }
	.tools { display: flex; flex-direction: column; gap: var(--space-3); margin-top: var(--space-4); padding-top: var(--space-4); border-top: 1px solid var(--border); align-items: flex-start; }
	.inat { display: flex; gap: var(--space-2); align-items: flex-end; flex-wrap: wrap; width: 100%; }
	.inat .field { flex: 1 1 14rem; }
</style>
