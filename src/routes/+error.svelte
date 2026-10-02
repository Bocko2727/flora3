<script lang="ts">
	import { page } from '$app/state';

	const title = $derived(
		page.status === 404 ? 'Не е намерено' : page.status === 403 ? 'Нямаш достъп' : 'Нещо се обърка'
	);

	const message = $derived(
		page.status === 404 && page.error?.message === 'Not Found'
			? 'Страницата не е намерена.'
			: page.error?.message
	);
</script>

<svelte:head><title>{title} · Флора</title></svelte:head>

<section class="stack">
	<h1>{title}</h1>
	<p>{message}</p>
	<p>
		<a href={page.url.pathname + page.url.search} data-sveltekit-reload>Опитай пак</a>
		· <a href="/">Към каталога</a>
	</p>
</section>
