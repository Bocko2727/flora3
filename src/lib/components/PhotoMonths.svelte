<script lang="ts">
	let { months, total, dated }: { months: number[]; total: number; dated: number } = $props();
	const NAMES = ['януари', 'февруари', 'март', 'април', 'май', 'юни', 'юли', 'август', 'септември', 'октомври', 'ноември', 'декември'];
</script>

<!-- When the plant was photographed, from the photo dates. Colour is not the only cue: a photographed month also
     gets a dot under its letter, and screen readers hear "снимано". -->
<section class="months" aria-labelledby="months-title">
	<h2 id="months-title">Снимки по месеци</h2>
	{#if months.length === 0}
		<p class="muted">Още няма снимки с дата.</p>
	{:else}
		<ol class="strip">
			{#each NAMES as name, i (name)}
				{@const on = months.includes(i + 1)}
				<li class:on title={name}>
					<span aria-hidden="true">{name[0].toUpperCase()}</span>
					<span class="visually-hidden">{name}{on ? ': снимано' : ''}</span>
				</li>
			{/each}
		</ol>
	{/if}
	{#if dated < total}
		<p class="muted note num">{total - dated} от {total} снимки са без дата и не се броят.</p>
	{/if}
</section>

<style>
	.months { margin-top: var(--space-5); }
	.months h2 { margin-top: 0; }
	.strip { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 3px; }
	.strip li {
		height: 28px;
		display: grid;
		place-items: center;
		border-radius: 4px;
		background: var(--surface-2);
		color: var(--muted);
		font-size: var(--text-xs);
		font-weight: 600;
	}
	.strip li { position: relative; }
	.strip li.on { background: var(--accent); color: var(--accent-contrast); }
	.strip li.on::after {
		content: '';
		position: absolute;
		bottom: 3px;
		width: 4px;
		height: 4px;
		border-radius: 50%;
		background: currentColor;
	}
	.strip li { height: 32px; }
	.note { font-size: var(--text-sm); margin: var(--space-2) 0 0; }
</style>
