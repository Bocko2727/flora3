<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { Candidate } from '$lib/identify/types';

	type Wiki = { name_bg: string | null; extract: string | null; url: string | null; title: string | null } | null;
	type Kind =
		| { kind: 'match'; index: number }
		| { kind: 'weak'; index: number; score: number }
		| { kind: 'mismatch'; sameGenus: number[] }
		| { kind: 'none' };
	type Props = {
		item: {
			identId: string;
			plantId: string;
			scientific_name: string;
			name_bg: string;
			thumbUrl: string | null;
			candidates: Candidate[];
			kind: Kind;
			wiki: Wiki;
			gbifMatch: string | null;
		};
	};
	let { item }: Props = $props();

	const pct = (score: number) => `${Math.round(score * 100)} %`;
	const top = $derived(item.candidates.slice(0, 3));
	const matchIndex = $derived(item.kind.kind === 'match' ? item.kind.index : null);
	const gbifOk = $derived(item.gbifMatch === 'accepted' || item.gbifMatch === 'synonym');
	const sameGenus = (i: number) => item.kind.kind === 'mismatch' && item.kind.sameGenus.includes(i);

	let busy = $state(false);
	let message = $state('');
	let changing = $state<number | null>(null);
	let changeWiki = $state<Wiki>(null);
	let changeWikiLoading = $state(false);
	let changeName = $state('');

	async function openChange(index: number) {
		changing = index;
		changeWiki = null;
		changeName = '';
		const key = item.candidates[index]?.gbif_key;
		if (!key) return;
		changeWikiLoading = true;
		try {
			const response = await fetch(`/api/review/wiki?key=${key}`);
			if (response.ok) {
				changeWiki = (await response.json()).wiki ?? null;
				changeName = changeWiki?.name_bg ?? '';
			}
		} finally {
			changeWikiLoading = false;
		}
	}

	const submit = () => {
		busy = true;
		message = '';
		return async ({ result }: { result: { type: string; data?: Record<string, unknown> } }) => {
			busy = false;
			if (result.type === 'failure') message = String(result.data?.message ?? 'Не успяхме да запишем решението.');
			else if (result.type === 'error') message = 'Не успяхме да запишем решението.';
			else await invalidateAll();
		};
	};
</script>

<article class="item box">
	<div class="head">
		{#if item.thumbUrl}<img src={item.thumbUrl} alt="" width="72" height="72" loading="lazy" />{:else}<span class="nophoto muted">няма</span>{/if}
		<div>
			<p class="latin"><a href={`/plants/${item.plantId}`}>{item.scientific_name}</a></p>
			<p class="muted">{item.name_bg} · старо име</p>
		</div>
	</div>

	{#if item.kind.kind === 'none'}
		<p class="muted">Pl@ntNet не разпозна растението. Остава чернова.</p>
	{:else}
		<ol class="candidates">
			{#each top as candidate, i (i)}
				<li class:hit={i === matchIndex}>
					<span><em>{candidate.scientific_name}</em>{#if candidate.family}{' · '}{candidate.family}{/if}</span>
					<span class="num">{pct(candidate.score)}</span>
					{#if sameGenus(i)}<span class="tag">същият род</span>{/if}
					{#if item.kind.kind !== 'match'}
						<button type="button" class="small" disabled={busy} onclick={() => void openChange(i)}>Смени с този</button>
					{/if}
				</li>
			{/each}
		</ol>
		{#if item.kind.kind === 'weak'}
			<p class="muted">Pl@ntNet предлага същото име, но с ниска увереност ({pct(item.kind.score)}).</p>
		{/if}
	{/if}

	{#if item.kind.kind === 'match'}
		<form method="POST" action="?/match" use:enhance={submit} class="stack">
			<input type="hidden" name="identId" value={item.identId} />
			{#if !gbifOk}<p class="muted">GBIF не потвърди името — статусът ще остане чернова.</p>{/if}
			{#if item.wiki?.extract}
				<details>
					<summary>Описание от Уикипедия</summary>
					<p class="prose">{item.wiki.extract}</p>
					{#if item.wiki.url}<p class="muted small-text">Текст: <a href={item.wiki.url} target="_blank" rel="noopener">Уикипедия</a>, CC BY-SA 4.0</p>{/if}
				</details>
				<label class="check"><input type="checkbox" name="useWikiText" checked /> Добави описанието от Уикипедия</label>
			{:else}
				<p class="muted">Няма статия в българската Уикипедия.</p>
			{/if}
			{#if item.wiki?.name_bg && item.wiki.name_bg !== item.name_bg}
				<label class="check"><input type="checkbox" name="useWikiName" /> Ползвай името от Уикипедия: {item.wiki.name_bg}</label>
			{/if}
			<button type="submit" class="primary" disabled={busy}>Съвпада</button>
		</form>
	{:else if item.kind.kind !== 'none'}
		{#if changing !== null}
			<form method="POST" action="?/change" use:enhance={submit} class="stack change">
				<input type="hidden" name="identId" value={item.identId} />
				<input type="hidden" name="index" value={changing} />
				<p>Ново име: <em>{item.candidates[changing].scientific_name}</em></p>
				{#if changeWikiLoading}
					<p class="muted" role="status">Търсене в Уикипедия…</p>
				{:else}
					<label class="field">
						<span>Българско име</span>
						<input name="nameBg" bind:value={changeName} maxlength="200" placeholder={item.candidates[changing].scientific_name} />
					</label>
					{#if changeWiki?.extract}
						<details>
							<summary>Описание от Уикипедия</summary>
							<p class="prose">{changeWiki.extract}</p>
							{#if changeWiki.url}<p class="muted small-text">Текст: <a href={changeWiki.url} target="_blank" rel="noopener">Уикипедия</a>, CC BY-SA 4.0</p>{/if}
						</details>
						<label class="check"><input type="checkbox" name="useWikiText" checked /> Добави описанието</label>
					{:else}
						<p class="muted">Няма статия в българската Уикипедия.</p>
					{/if}
				{/if}
				<div class="row">
					<button type="submit" class="primary" disabled={busy || changeWikiLoading}>Запиши смяната</button>
					<button type="button" disabled={busy} onclick={() => (changing = null)}>Отказ</button>
				</div>
			</form>
		{/if}
		<form method="POST" action="?/keep" use:enhance={submit}>
			<input type="hidden" name="identId" value={item.identId} />
			<button type="submit" disabled={busy}>Остави старото</button>
		</form>
	{/if}
	{#if message}<p class="field-error" role="alert">{message}</p>{/if}
</article>

<style>
	.item { display: flex; flex-direction: column; gap: var(--space-2); }
	.head { display: flex; gap: var(--space-3); align-items: center; }
	.head img, .nophoto { width: 72px; height: 72px; border-radius: var(--radius-sm); object-fit: cover; flex: none; display: grid; place-items: center; background: var(--surface); }
	.latin { margin: 0; font-style: italic; font-weight: 600; }
	.latin a { color: inherit; }
	.head p { margin: 0; }
	.candidates { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-1); }
	.candidates li { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); padding: var(--space-1) 0; border-top: 1px solid var(--border); }
	.candidates li.hit { color: var(--accent); }
	.candidates .num { margin-left: auto; font-variant-numeric: tabular-nums; }
	.tag { font-size: var(--text-xs); border: 1px solid var(--muted); border-radius: 999px; padding: 0 var(--space-2); }
	button.small { min-height: 44px; }
	.check { display: flex; gap: var(--space-2); align-items: center; min-height: 44px; }
	.row { display: flex; gap: var(--space-2); flex-wrap: wrap; }
	.small-text { font-size: var(--text-xs); }
	.change { border-top: 1px dashed var(--border); padding-top: var(--space-2); }
</style>
