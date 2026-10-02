<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import PhotoManager from '$lib/components/PhotoManager.svelte';
	import PhotoUploader from '$lib/components/PhotoUploader.svelte';
	import PlantForm from '$lib/components/PlantForm.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let saving = $state(false);
	let confirmDelete = $state(false);
</script>

<svelte:head><title>Редакция · {data.plant.name_bg} · Флора</title></svelte:head>

<p><a href={`/plants/${data.plant.id}`}>← Към растението</a></p>
<h1>Редакция: {data.plant.name_bg}</h1>

<form
	method="POST"
	action="?/update"
	class="stack"
	use:enhance={() => {
		saving = true;
		return async ({ update }) => {
			await update({ reset: false });
			saving = false;
		};
	}}
>
	<PlantForm initial={data.values} errors={form?.errors ?? {}} legacy={data.legacy} />
	{#if form?.message}<p class="error" role="alert">{form.message}</p>{/if}
	<div class="row">
		<button type="submit" class="primary" disabled={saving}>{saving ? 'Записване…' : 'Запази'}</button>
		<a class="button" href={`/plants/${data.plant.id}`}>Отказ</a>
	</div>
</form>

<section class="stack">
	<h2>Снимки</h2>
	<PhotoManager photos={data.photos} />
	<PhotoUploader plantId={data.plant.id} ownerId={data.user?.id ?? ''} onsettled={() => void invalidateAll()} />
</section>

<section class="stack danger-zone">
	<h2>Изтриване</h2>
	{#if !confirmDelete}
		<button type="button" onclick={() => (confirmDelete = true)}>Изтрий растението</button>
	{:else}
		<form method="POST" action="?/delete" use:enhance class="stack">
			<p>Сигурен ли си? Растението и всичките му снимки ще бъдат изтрити завинаги.</p>
			<div class="row">
				<button type="submit" class="danger">Да, изтрий завинаги</button>
				<button type="button" onclick={() => (confirmDelete = false)}>Отказ</button>
			</div>
		</form>
	{/if}
</section>

<style>
	.row { display: flex; gap: 0.5rem; flex-wrap: wrap; }
	.danger-zone { margin-top: 2rem; border-top: 1px solid var(--border); padding-top: 1rem; }
</style>
