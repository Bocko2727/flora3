import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../src/lib/database.types';
import { createPlant, updatePlant } from '$lib/server/plants';
import { decideChange, decideKeep, decideMatch, prepareReview } from '$lib/server/review';
import { EDITOR, VIEWER, adminClient, ensureUser, signedInClient } from '../helpers/supabase';

const fixture = (name: string) => readFileSync(`tests/unit/fixtures/${name}`, 'utf8');
const accepted = JSON.parse(fixture('gbif-match-accepted.json')) as Record<string, unknown>; // Myosotis arvensis 5341258

const wikiSearch = JSON.stringify({ query: { search: [{ title: 'Q1' }] } });
const wikiEntity = (bg: string | null, article: string | null) =>
	JSON.stringify({
		entities: {
			Q1: {
				labels: bg ? { bg: { value: bg } } : {},
				sitelinks: article ? { bgwiki: { title: article } } : {}
			}
		}
	});
const wikiSummary = JSON.stringify({
	extract: 'Полската незабравка е едногодишно растение.',
	content_urls: { desktop: { page: 'https://bg.wikipedia.org/wiki/Polska' } }
});

function routed(routes: Record<string, string>) {
	return vi.fn<typeof fetch>(async (input) => {
		const url = String(input);
		const hit = Object.entries(routes).find(([part]) => url.includes(part));
		if (!hit) throw new Error(`unexpected url ${url}`);
		return new Response(hit[1], { status: 200, headers: { 'content-type': 'application/json' } });
	});
}

const gbifFor = (name: string, key: number, family = 'Boraginaceae') =>
	JSON.stringify({ ...accepted, canonicalName: name, scientificName: name, usageKey: key, family });

const base = (name: string) => ({ scientific_name: name, name_bg: 'Старо име', family: null, description: null, habitat: null, notes: 'моя бележка' });
const cand = (scientific_name: string, score: number, gbif_key: number | null) => ({
	scientific_name,
	authorship: null,
	family: 'Boraginaceae',
	genus: scientific_name.split(' ')[0],
	common_names: [],
	score,
	gbif_key
});

let editor: SupabaseClient<Database>;
let viewer: SupabaseClient<Database>;

beforeAll(async () => {
	await ensureUser(EDITOR, { editor: true });
	await ensureUser(VIEWER, { editor: false });
	editor = await signedInClient(EDITOR);
	viewer = await signedInClient(VIEWER);
});

async function legacyPlant(name: string) {
	const id = randomUUID();
	await createPlant(editor, id, base(name), 'legacy_ai');
	await adminClient().from('plants').update({ legacy_ai: { recognition: 'стар текст' } }).eq('id', id);
	return id;
}

const reviewRow = async (plantId: string) =>
	(await adminClient().from('identifications').select('*').eq('plant_id', plantId).eq('source', 'review').single()).data!;
const plantRow = async (plantId: string) =>
	(await adminClient().from('plants').select('*, id_status').eq('id', plantId).single()).data!;

describe('review', () => {
	it('prepareReview is idempotent and stores GBIF + wiki', async () => {
		const id = await legacyPlant('Myosotis arvensis');
		const fetchFn = routed({
			'species/match': gbifFor('Myosotis arvensis', 5341258),
			'list=search': wikiSearch,
			wbgetentities: wikiEntity('Полска незабравка', 'Полска незабравка'),
			'page/summary': wikiSummary
		});
		const ident = { modelVersion: 'x', photoCount: 1, candidates: [cand('Myosotis arvensis', 0.8, 5341258)] };
		expect(await prepareReview(editor, id, ident, fetchFn)).toBe('prepared');
		expect(await prepareReview(editor, id, ident, fetchFn)).toBe('exists');
		const row = await reviewRow(id);
		expect(row).toMatchObject({ decision: null, chosen_index: null, source: 'review' });
		expect(row.wiki).toMatchObject({ name_bg: 'Полска незабравка', extract: 'Полската незабравка е едногодишно растение.' });
		const p = await plantRow(id);
		expect(p.gbif_match).toBe('accepted');
		expect(p.id_status).toBe('draft');
	});

	it('decideMatch raises the status and adds the Wikipedia text, keeping the name', async () => {
		const id = await legacyPlant('Myosotis arvensis');
		const fetchFn = routed({
			'species/match': gbifFor('Myosotis arvensis', 5341258),
			'list=search': wikiSearch,
			wbgetentities: wikiEntity('Полска незабравка', 'Полска незабравка'),
			'page/summary': wikiSummary
		});
		await prepareReview(editor, id, { modelVersion: 'x', photoCount: 1, candidates: [cand('Myosotis arvensis', 0.8, 5341258)] }, fetchFn);
		const row = await reviewRow(id);
		await decideMatch(editor, row.id, { useWikiName: false, useWikiText: true });
		const p = await plantRow(id);
		expect(p).toMatchObject({
			id_status: 'ai_gbif',
			name_bg: 'Старо име',
			description: 'Полската незабравка е едногодишно растение.',
			description_source: 'wikipedia',
			wiki_url: 'https://bg.wikipedia.org/wiki/Polska',
			notes: 'моя бележка'
		});
		expect((await reviewRow(id)).decision).toBe('match');
		await expect(decideKeep(editor, row.id)).rejects.toThrow();
	});

	it('decideChange renames, uses the Latin name without a Bulgarian one and keeps notes and legacy text', async () => {
		const id = await legacyPlant('Myosotis sylvatica');
		await prepareReview(
			editor,
			id,
			{ modelVersion: 'x', photoCount: 1, candidates: [cand('Myosotis arvensis', 0.7, 5341258)] },
			routed({ 'species/match': gbifFor('Myosotis sylvatica', 5341270), 'list=search': JSON.stringify({ query: { search: [] } }) })
		);
		const row = await reviewRow(id);
		await decideChange(
			editor,
			row.id,
			0,
			{ nameBg: null, useWikiText: true },
			routed({
				'species/match': gbifFor('Myosotis arvensis', 5341258, 'Boraginaceae'),
				'list=search': wikiSearch,
				wbgetentities: wikiEntity(null, null)
			})
		);
		const p = await plantRow(id);
		expect(p).toMatchObject({
			scientific_name: 'Myosotis arvensis',
			name_bg: 'Myosotis arvensis',
			family: 'Boraginaceae',
			name_source: 'ai',
			description: null,
			description_source: null,
			habitat: null,
			notes: 'моя бележка',
			legacy_ai: { recognition: 'стар текст' },
			gbif_key: 5341258,
			id_status: 'ai_gbif'
		});
		expect(await reviewRow(id)).toMatchObject({ decision: 'changed', chosen_index: 0 });
	});

	it('decideKeep records the decision and leaves the plant a draft', async () => {
		const id = await legacyPlant('Myosotis sylvatica');
		await prepareReview(
			editor,
			id,
			{ modelVersion: 'x', photoCount: 1, candidates: [cand('Myosotis arvensis', 0.7, 5341258)] },
			routed({ 'species/match': gbifFor('Myosotis sylvatica', 5341270), 'list=search': JSON.stringify({ query: { search: [] } }) })
		);
		const row = await reviewRow(id);
		await expect(decideMatch(editor, row.id, { useWikiName: false, useWikiText: false })).rejects.toThrow();
		await decideKeep(editor, row.id);
		expect((await reviewRow(id)).decision).toBe('kept');
		expect((await plantRow(id)).id_status).toBe('draft');
	});

	it('a viewer cannot prepare a review', async () => {
		const id = await legacyPlant('Myosotis arvensis');
		await expect(
			prepareReview(viewer, id, { modelVersion: 'x', photoCount: 1, candidates: [] }, routed({ 'species/match': gbifFor('Myosotis arvensis', 5341258) }))
		).rejects.toThrow();
	});

	it('editing the description marks it manual; an untouched Wikipedia text keeps its label', async () => {
		const id = await legacyPlant('Myosotis arvensis');
		await adminClient().from('plants').update({ description: 'Из Уикипедия.', description_source: 'wikipedia' }).eq('id', id);
		await updatePlant(editor, id, { ...base('Myosotis arvensis'), description: 'Из Уикипедия.' });
		expect((await plantRow(id)).description_source).toBe('wikipedia');
		await updatePlant(editor, id, { ...base('Myosotis arvensis'), description: 'Моят текст.' });
		expect((await plantRow(id)).description_source).toBe('manual');
		await updatePlant(editor, id, { ...base('Myosotis arvensis'), description: null });
		expect((await plantRow(id)).description_source).toBeNull();
	});
});
