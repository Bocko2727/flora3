import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../src/lib/database.types';
import { UserFacingError } from '$lib/errors';
import { createPlant, getPlant } from '$lib/server/plants';
import { linkInat, refreshNameCheck, unlinkInat, useAcceptedName } from '$lib/server/verification';
import { EDITOR, VIEWER, ensureUser, resetCatalog, signedInClient } from '../helpers/supabase';

const fixture = (name: string) => readFileSync(`tests/unit/fixtures/${name}`, 'utf8');
const json = (body: string) => new Response(body, { status: 200, headers: { 'content-type': 'application/json' } });
const NO_RIGHTS = 'Растението не е намерено или нямаш права да го променяш.';

function routedFetch(routes: Record<string, string>) {
	return vi.fn<typeof fetch>(async (input) => {
		const url = String(input);
		const hit = Object.entries(routes).find(([part]) => url.includes(part));
		if (!hit) throw new Error(`unexpected url ${url}`);
		return json(hit[1]);
	});
}

const base = (name: string) => ({
	scientific_name: name,
	name_bg: 'Тест',
	family: null,
	description: null,
	habitat: null,
	notes: null
});

let editor: SupabaseClient<Database>;
let viewer: SupabaseClient<Database>;

beforeAll(async () => {
	await ensureUser(EDITOR, { editor: true });
	await ensureUser(VIEWER, { editor: false });
	editor = await signedInClient(EDITOR);
	viewer = await signedInClient(VIEWER);
});

beforeEach(async () => {
	await resetCatalog();
});

async function newPlant(name: string): Promise<string> {
	const id = randomUUID();
	await createPlant(editor, id, base(name));
	return id;
}

async function addIdentification(plantId: string, name: string, score: number, gbifKey: number | null) {
	const { error } = await editor.from('identifications').insert({
		plant_id: plantId,
		model_version: 'test',
		photo_count: 1,
		candidates: [
			{ scientific_name: name, authorship: null, family: null, genus: null, common_names: [], score, gbif_key: gbifKey }
		],
		chosen_index: 0
	});
	if (error) throw error;
}

describe('refreshNameCheck', () => {
	it('stores the GBIF result; status follows the identification protocol', async () => {
		const id = await newPlant('Myosotis arvensis');
		const fetchFn = routedFetch({ 'species/match': fixture('gbif-match-accepted.json') });
		expect(await refreshNameCheck(editor, id, 'Myosotis arvensis', fetchFn)).toBe(true);

		const checked = await getPlant(editor, id);
		expect(checked).toMatchObject({
			gbif_match: 'accepted',
			gbif_key: 5341258,
			gbif_accepted_key: null,
			gbif_accepted_name: null,
			id_status: 'draft'
		});
		expect(checked?.gbif_checked_at).toBeTruthy();

		await addIdentification(id, 'Myosotis arvensis', 0.62, 5341258);
		expect((await getPlant(editor, id))?.id_status).toBe('ai_gbif');
	});

	it('returns false and writes nothing when GBIF fails', async () => {
		const id = await newPlant('Myosotis arvensis');
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const fetchFn = vi.fn<typeof fetch>(async () => {
			throw new Error('network down');
		});
		expect(await refreshNameCheck(editor, id, 'Myosotis arvensis', fetchFn)).toBe(false);
		spy.mockRestore();
		const plant = await getPlant(editor, id);
		expect(plant).not.toBeNull();
		expect(plant?.gbif_checked_at).toBeNull();
		expect(plant?.gbif_match).toBeNull();
	});

	it('refuses a viewer', async () => {
		const id = await newPlant('Myosotis arvensis');
		const fetchFn = routedFetch({ 'species/match': fixture('gbif-match-accepted.json') });
		await expect(refreshNameCheck(viewer, id, 'Myosotis arvensis', fetchFn)).rejects.toThrow(
			new UserFacingError(NO_RIGHTS)
		);
	});
});

describe('useAcceptedName', () => {
	it('swaps a synonym for the accepted name, marks it manual and re-checks', async () => {
		const id = await newPlant('Myosotis scorpioides');
		const fetchFn = routedFetch({
			'species/match': fixture('gbif-match-synonym.json'),
			'species/5341270': fixture('gbif-species-accepted.json')
		});
		await refreshNameCheck(editor, id, 'Myosotis scorpioides', fetchFn);
		expect((await getPlant(editor, id))?.gbif_accepted_name).toBe('Myosotis palustris');

		const second = routedFetch({ 'species/match': fixture('gbif-match-accepted.json') });
		await useAcceptedName(editor, id, second);
		const swapped = await getPlant(editor, id);
		expect(swapped?.scientific_name).toBe('Myosotis palustris');
		expect(swapped?.name_source).toBe('manual');
		expect(second).toHaveBeenCalled();
	});

	it('explains when there is no accepted name', async () => {
		const id = await newPlant('Bellis perennis');
		await expect(useAcceptedName(editor, id)).rejects.toThrow(new UserFacingError('Няма прието име за смяна.'));
	});
});

describe('linkInat / unlinkInat', () => {
	const url = 'https://www.inaturalist.org/observations/42';

	it('links a Research Grade observation of the same species and gives community status', async () => {
		const id = await newPlant('Myosotis arvensis');
		const fetchFn = routedFetch({ 'observations/42': fixture('inat-obs.json') });
		await linkInat(editor, id, url, fetchFn);
		expect(await getPlant(editor, id)).toMatchObject({
			inat_observation_id: 42,
			inat_quality_grade: 'research',
			inat_taxon_name: 'Myosotis arvensis',
			id_status: 'community'
		});
		expect((await getPlant(editor, id))?.inat_checked_at).toBeTruthy();
	});

	it('does not give community status for a different species', async () => {
		const id = await newPlant('Bellis perennis');
		await linkInat(editor, id, url, routedFetch({ 'observations/42': fixture('inat-obs.json') }));
		const plant = await getPlant(editor, id);
		expect(plant?.inat_taxon_name).toBe('Myosotis arvensis');
		expect(plant?.id_status).not.toBe('community');
	});

	it('rejects a link that is not an iNaturalist observation', async () => {
		const id = await newPlant('Bellis perennis');
		await expect(linkInat(editor, id, 'https://example.com/x', vi.fn())).rejects.toThrow(
			new UserFacingError('Това не е линк към наблюдение в iNaturalist.')
		);
	});

	it('reports a missing observation', async () => {
		const id = await newPlant('Bellis perennis');
		const empty = routedFetch({ 'observations/42': JSON.stringify({ total_results: 0, results: [] }) });
		await expect(linkInat(editor, id, url, empty)).rejects.toThrow(new UserFacingError('Наблюдението не е намерено.'));
	});

	it('unlinks: all four columns become null', async () => {
		const id = await newPlant('Myosotis arvensis');
		await linkInat(editor, id, url, routedFetch({ 'observations/42': fixture('inat-obs.json') }));
		await unlinkInat(editor, id);
		expect(await getPlant(editor, id)).toMatchObject({
			inat_observation_id: null,
			inat_quality_grade: null,
			inat_taxon_name: null,
			inat_checked_at: null,
			id_status: 'draft'
		});
	});

	it('refuses a viewer', async () => {
		const id = await newPlant('Myosotis arvensis');
		await expect(
			linkInat(viewer, id, url, routedFetch({ 'observations/42': fixture('inat-obs.json') }))
		).rejects.toThrow(new UserFacingError(NO_RIGHTS));
		await expect(unlinkInat(viewer, id)).rejects.toThrow(new UserFacingError(NO_RIGHTS));
	});
});

describe('getPlant latestIdentification', () => {
	it('is null without a protocol and returns the newest one otherwise', async () => {
		const id = await newPlant('Myosotis arvensis');
		expect((await getPlant(editor, id))?.latestIdentification).toBeNull();
		await addIdentification(id, 'Myosotis arvensis', 0.62, 5341258);
		const latest = (await getPlant(editor, id))?.latestIdentification;
		expect(latest).toMatchObject({ model_version: 'test', chosen_index: 0 });
		expect(latest?.candidates[0]).toMatchObject({ scientific_name: 'Myosotis arvensis', score: 0.62 });
		expect(latest?.created_at).toBeTruthy();
	});
});
