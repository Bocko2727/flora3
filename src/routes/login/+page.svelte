<script lang="ts">
	import { enhance } from '$app/forms';
	import mark from '$lib/assets/favicon.svg';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
	let submitting = $state(false);
</script>

<svelte:head><title>Вход · Флора</title></svelte:head>

<section class="login box stack">
	<div>
		<img class="mark" src={mark} alt="" width="48" height="48" />
		<h1>Флора</h1>
		<p class="muted tagline">Личен ботанически каталог</p>
	</div>
	<form
		method="POST"
		class="stack"
		use:enhance={() => {
			submitting = true;
			return async ({ update }) => {
				await update();
				submitting = false;
			};
		}}
	>
		<div class="field">
			<label for="email">Имейл</label>
			<input id="email" name="email" type="email" autocomplete="email" required defaultValue={form?.email ?? ''} />
		</div>
		<div class="field">
			<label for="password">Парола</label>
			<input id="password" name="password" type="password" autocomplete="current-password" required />
		</div>
		{#if form?.message}
			<p class="error" role="alert">{form.message}</p>
		{/if}
		<button type="submit" class="primary" disabled={submitting}>
			{submitting ? 'Влизане…' : 'Вход'}
		</button>
	</form>
</section>

<style>
	.mark { margin-bottom: var(--space-3); }
	.login { max-width: 380px; margin: 10vh auto 0; padding: var(--space-5); }
	h1 { font-size: var(--text-2xl); margin: 0; }
	.tagline { margin: var(--space-1) 0 0; }
	button { width: 100%; }
</style>
