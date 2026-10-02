<script lang="ts">
	import { page } from '$app/state';

	const title = $derived(
		page.status === 404 ? 'Не е намерено' : page.status === 403 ? 'Нямаш достъп' : 'Нещо се обърка'
	);
</script>

<svelte:head><title>{title} · Флора</title></svelte:head>

<section class="stack">
	<h1>{title}</h1>
	<p>{page.error?.message}</p>
	<p>
		<a href={page.url.pathname + page.url.search} data-sveltekit-reload>Опитай пак</a>
		· <a href="/">Към каталога</a>
	</p>
</section>
