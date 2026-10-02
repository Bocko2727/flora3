<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

{#if data.user}
	<header class="site-header">
		<a class="brand" href="/"><img src={favicon} alt="" width="28" height="28" />Флора</a>
		<form method="POST" action="/logout" class="session">
			<span class="muted who">{data.user.email}</span>
			<button type="submit" class="link-button">Изход</button>
		</form>
	</header>
{/if}

<main class="page">
	{@render children()}
</main>
