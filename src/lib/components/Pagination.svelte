<script lang="ts">
	import { PAGE_SIZES, pageWindow, type PageSize } from '$lib/catalog/filter';

	type Props = { page: number; pages: number; size: PageSize; href: (p: number, n: PageSize) => string };
	let { page, pages, size, href }: Props = $props();

	const slots = $derived(pageWindow(page, pages));
</script>

<nav class="pagination" aria-label="Страници">
	{#if pages > 1}
		<ol class="numbers">
			{#each slots as slot, i (slot ?? `gap-${i}`)}
				<li>
					{#if slot === null}
						<span class="gap" aria-hidden="true">…</span>
					{:else}
						<a href={href(slot, size)} aria-current={slot === page ? 'page' : undefined}>{slot}</a>
					{/if}
				</li>
			{/each}
		</ol>
	{/if}
	<div class="sizes" role="group" aria-labelledby="page-size-label">
		<span id="page-size-label" class="muted">На страница</span>
		<span class="segmented">
			{#each PAGE_SIZES as n (n)}
				<a href={href(1, n)} aria-current={n === size ? 'true' : undefined}>{n}</a>
			{/each}
		</span>
	</div>
</nav>

<style>
	.pagination {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3) var(--space-4);
		margin-top: var(--space-5);
		font-variant-numeric: tabular-nums;
	}
	.numbers { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 2px; }
	a,
	.gap {
		min-width: 44px;
		min-height: 44px;
		display: inline-grid;
		place-items: center;
		padding: 0 var(--space-2);
		border-radius: var(--radius-sm);
		font-weight: 500;
	}
	a { color: var(--text); text-decoration: none; }
	a:hover { background: var(--surface-2); }
	.gap { color: var(--muted); }
	.numbers a[aria-current='page'] { background: var(--text); color: var(--bg); font-weight: 600; }
	.sizes { display: flex; align-items: center; gap: var(--space-2); font-size: var(--text-sm); }
	.segmented { display: inline-flex; padding: 2px; gap: 2px; border: 1px solid var(--border); border-radius: calc(var(--radius-sm) + 3px); }
	.segmented a { font-size: var(--text-base); }
	.segmented a[aria-current='true'] { background: var(--surface-2); color: var(--accent); font-weight: 600; box-shadow: inset 0 0 0 1px var(--line-strong); }
</style>
