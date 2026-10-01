<script lang="ts">
	import '../app.css';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
</script>

{#if data.user}
	<header class="site-header">
		<a class="brand" href="/">Флора</a>
		<form method="POST" action="/logout" class="session">
			<span class="muted who">{data.user.email}</span>
			<button type="submit" class="link-button">Изход</button>
		</form>
	</header>
{/if}

<main class="page">
	{@render children()}
</main>
