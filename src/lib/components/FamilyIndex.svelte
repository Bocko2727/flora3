<script lang="ts">
	import type { FamilyGroup } from '$lib/catalog/families';

	type Props = { groups: FamilyGroup[]; href: (latin: string) => string };
	let { groups, href }: Props = $props();

	const largest = $derived(groups[0]?.count ?? 1);
</script>

{#if groups.length === 0}
	<p class="muted">Още няма растения със записано семейство.</p>
{:else}
	<p class="muted count">{groups.length} {groups.length === 1 ? 'семейство' : 'семейства'} · избери едно, за да видиш растенията му</p>
	<ul class="families" aria-label="Семейства">
		{#each groups as group (group.latin)}
			<li>
				<a href={href(group.latin)}>
					<span class="top">
						<span class="latin">{group.latin}</span>
						<span class="n num" aria-label="{group.count} {group.count === 1 ? 'растение' : 'растения'}">{group.count}</span>
					</span>
					<span class="bg">{group.bg ?? ' '}</span>
					<span class="bar" aria-hidden="true"><span style:width="{Math.max(6, (group.count / largest) * 100)}%"></span></span>
				</a>
			</li>
		{/each}
	</ul>
{/if}

<style>
	.count { font-size: var(--text-sm); margin: 0 0 var(--space-3); }
	/* Every family fits on one desktop screen: small tiles in as many columns as fit. */
	.families {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: var(--space-2);
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
	@media (min-width: 640px) {
		.families { grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); }
	}
	a {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-height: 44px;
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--border);
		border-left: 3px solid var(--accent);
		border-radius: var(--radius-sm);
		background: var(--surface);
		color: var(--text);
		text-decoration: none;
	}
	a:hover { background: var(--surface-2); }
	a:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
	.top { display: flex; justify-content: space-between; align-items: baseline; gap: var(--space-2); min-width: 0; }
	.latin {
		font-family: var(--font-display);
		font-style: italic;
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.n { color: var(--muted); font-size: var(--text-sm); font-variant-numeric: tabular-nums; }
	.bg { color: var(--muted); font-size: var(--text-xs); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.bar { height: 3px; margin-top: 4px; border-radius: 2px; background: var(--border); overflow: hidden; }
	.bar span { display: block; height: 100%; background: var(--accent); }
	@media (max-width: 420px) {
		.bar { display: none; }
	}
</style>
