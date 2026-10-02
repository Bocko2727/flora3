import { error, fail } from '@sveltejs/kit';
import { UserFacingError } from '$lib/errors';
import { isEditor } from '$lib/server/auth';
import { externalFetch } from '$lib/server/external/fetch';
import { toHttpError } from '$lib/server/http';
import { decideChange, decideKeep, decideMatch, loadReview, matchAllReview } from '$lib/server/review';
import { signPaths } from '$lib/server/signed-urls';
import type { Actions, PageServerLoad } from './$types';

async function requireEditorOr404(locals: App.Locals) {
	if (!locals.user || !(await isEditor(locals.supabase))) error(404, 'Страницата не е намерена.');
}

export const load: PageServerLoad = async ({ locals }) => {
	await requireEditorOr404(locals);
	const review = await loadReview(locals.supabase).catch(toHttpError);
	const urls = await signPaths(locals.supabase, [
		...review.toPrepare.map((p) => p.photoPath),
		...review.items.flatMap((i) => (i.thumbPath ? [i.thumbPath] : []))
	]).catch(toHttpError);
	return {
		decided: review.decided,
		toPrepare: review.toPrepare.map((p) => ({ id: p.id, photoUrl: urls.get(p.photoPath) ?? null })),
		items: review.items.map(({ photoPath: _photo, thumbPath, ...item }) => ({
			...item,
			thumbUrl: thumbPath ? (urls.get(thumbPath) ?? null) : null
		}))
	};
};

async function run(task: () => Promise<unknown>) {
	try {
		return { done: await task() };
	} catch (e) {
		if (e instanceof UserFacingError) return fail(400, { message: e.message });
		throw e;
	}
}

const text = (form: FormData, name: string) => {
	const v = form.get(name);
	return typeof v === 'string' ? v : '';
};
const flag = (form: FormData, name: string) => form.get(name) === 'on' || form.get(name) === 'true';

export const actions: Actions = {
	match: async ({ request, locals }) => {
		await requireEditorOr404(locals);
		const form = await request.formData();
		return run(() =>
			decideMatch(locals.supabase, text(form, 'identId'), {
				useWikiName: flag(form, 'useWikiName'),
				useWikiText: flag(form, 'useWikiText')
			})
		);
	},
	matchAll: async ({ request, locals }) => {
		await requireEditorOr404(locals);
		const form = await request.formData();
		const ids = form.getAll('identId').filter((v): v is string => typeof v === 'string');
		return run(() => matchAllReview(locals.supabase, ids));
	},
	change: async ({ request, locals }) => {
		await requireEditorOr404(locals);
		const form = await request.formData();
		const nameBg = text(form, 'nameBg').trim();
		return run(() =>
			decideChange(
				locals.supabase,
				text(form, 'identId'),
				Number(text(form, 'index')),
				{ nameBg: nameBg || null, useWikiText: flag(form, 'useWikiText') },
				externalFetch()
			)
		);
	},
	keep: async ({ request, locals }) => {
		await requireEditorOr404(locals);
		const form = await request.formData();
		return run(() => decideKeep(locals.supabase, text(form, 'identId')));
	}
};
