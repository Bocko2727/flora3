import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { EDITOR, VIEWER, adminClient, ensureUser, resetCatalog, type TestUser } from '../helpers/supabase';

const fixture = (name: string) => `tests/e2e/fixtures/${name}`;

// The dev server hydrates after the first paint; typing before that resets the controlled
// email input. Wait for the module requests to settle before touching the form.
async function gotoSettled(page: Page, url: string) {
	await page.goto(url);
	await page.waitForLoadState('networkidle');
}

async function login(page: Page, user: TestUser) {
	await gotoSettled(page, '/login');
	await page.getByLabel('Имейл').fill(user.email);
	await page.getByLabel('Парола').fill(user.password);
	await page.getByRole('button', { name: 'Вход' }).click();
	await expect(page.getByRole('heading', { name: 'Каталог' })).toBeVisible();
}

async function logout(page: Page) {
	await page.getByRole('button', { name: 'Изход' }).click();
	await expect(page).toHaveURL(/\/login/);
}

test.describe.configure({ mode: 'serial' });

let plantUrl = '';
const plantId = () => plantUrl.split('/').pop()!;

test('login rejects a wrong password and protects pages', async ({ page }) => {
	await gotoSettled(page, '/');
	await expect(page).toHaveURL(/\/login\?next=%2F/);
	await page.getByLabel('Имейл').fill(EDITOR.email);
	await page.getByLabel('Парола').fill('wrong-password-123');
	await page.getByRole('button', { name: 'Вход' }).click();
	await expect(page.getByRole('alert')).toHaveText('Грешен имейл или парола.');
	await login(page, EDITOR);
	await expect(page.getByText('Още няма растения.')).toBeVisible();
});

test('login form keeps text typed before hydration', async ({ page }) => {
	await page.goto('/login');
	await page.getByLabel('Имейл').fill(EDITOR.email);
	await page.waitForLoadState('networkidle');
	await expect(page.getByLabel('Имейл')).toHaveValue(EDITOR.email);
	await page.getByLabel('Парола').fill(EDITOR.password);
	await page.getByRole('button', { name: 'Вход' }).click();
	await expect(page.getByRole('heading', { name: 'Каталог' })).toBeVisible();
	await logout(page);
});

test('editor adds a plant with two photos', async ({ page }) => {
	await login(page, EDITOR);
	await page.getByRole('link', { name: '+ Растение' }).click();
	await page.getByLabel('Българско име').fill('Паричка');
	await page.getByLabel('Латинско име').fill('Bellis perennis');
	await page.getByLabel('Снимки', { exact: true }).setInputFiles([fixture('leaf-a.jpg'), fixture('leaf-b.jpg')]);
	await page.getByRole('button', { name: 'Запази растението' }).click();
	await expect(page.getByRole('heading', { name: 'Паричка' })).toBeVisible({ timeout: 30_000 });
	plantUrl = new URL(page.url()).pathname;
	await expect(page.getByRole('button', { name: /Отвори снимка \d от 2/ })).toHaveCount(2);

	const { data } = await adminClient()
		.from('plant_photos')
		.select('is_primary, mime, path, thumb_path')
		.eq('plant_id', plantId());
	expect(data?.length).toBe(2);
	expect(data?.filter((p) => p.is_primary).length).toBe(1);
	expect(data?.every((p) => p.mime === 'image/webp')).toBe(true);
	const ext = (path: string) => path.slice(path.lastIndexOf('.'));
	expect(data?.every((p) => ext(p.thumb_path) === ext(p.path))).toBe(true);
});

test('gallery opens full screen and closes with Escape', async ({ page }) => {
	await login(page, EDITOR);
	await gotoSettled(page, plantUrl);
	await page.getByRole('button', { name: 'Отвори снимка 1 от 2' }).click();
	const viewer = page.getByRole('dialog', { name: 'Снимка на цял екран' });
	await expect(viewer).toBeVisible();
	await expect(viewer.getByText('1 / 2')).toBeVisible();
	await viewer.getByRole('button', { name: 'Следваща' }).click();
	await expect(viewer.getByText('2 / 2')).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(viewer).toBeHidden();
});

test('duplicate photo is rejected and a rotated photo keeps portrait orientation', async ({ page }) => {
	await login(page, EDITOR);
	await gotoSettled(page, `${plantUrl}/edit`);
	await page.getByLabel('Добави снимки').setInputFiles([fixture('leaf-a.jpg')]);
	await expect(page.getByText('Тази снимка вече е качена.')).toBeVisible({ timeout: 30_000 });
	const admin = adminClient();
	const rows = await admin.from('plant_photos').select('owner_id').eq('plant_id', plantId());
	expect(rows.data?.length).toBe(2);
	const folder = await admin.storage.from('photos').list(`${rows.data![0].owner_id}/${plantId()}`);
	expect(folder.error).toBeNull();
	expect(folder.data?.length).toBe(4);

	await page.getByLabel('Добави снимки').setInputFiles([fixture('rotated.jpg')]);
	await expect(page.getByText('Готово')).toBeVisible({ timeout: 30_000 });
	const { data } = await adminClient()
		.from('plant_photos')
		.select('width, height')
		.eq('plant_id', plantId())
		.eq('width', 300);
	expect(data).toEqual([{ width: 300, height: 400 }]);
});

test('editor edits the plant, changes the primary photo and sees the draft status', async ({ page }) => {
	await login(page, EDITOR);
	await gotoSettled(page, `${plantUrl}/edit`);
	const primaryIds = async () =>
		((await adminClient().from('plant_photos').select('id').eq('plant_id', plantId()).eq('is_primary', true)).data ?? []).map(
			(r) => r.id
		);
	const before = await primaryIds();
	expect(before.length).toBe(1);
	await page.getByRole('button', { name: 'Направи основна' }).first().click();
	await expect
		.poll(async () => {
			const now = await primaryIds();
			return now.length === 1 && now[0] !== before[0];
		})
		.toBe(true);
	await expect(page.getByText('Основна', { exact: true })).toHaveCount(1);
	await expect(page.getByRole('button', { name: 'Направи основна' })).toHaveCount(2);
	for (const button of await page.getByRole('button', { name: 'Направи основна' }).all()) {
		await expect(button).toBeEnabled();
	}
	await page.getByLabel('Българско име').fill('Обикновена паричка');
	await page.getByLabel('Описание').fill('Розетка от лъжичести листа.');
	await page.getByRole('button', { name: 'Запази', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Обикновена паричка' })).toBeVisible();
	await expect(page.getByText('Розетка от лъжичести листа.')).toBeVisible();
	await expect(page.getByText('Чернова', { exact: true }).first()).toBeVisible();
	await expect(page.getByRole('button', { name: 'Потвърди', exact: true })).toHaveCount(0);
	await gotoSettled(page, '/');
	await page.getByLabel('Търси').fill('ОБИКНОВЕНА');
	await expect(page.getByRole('link', { name: /Обикновена паричка/ })).toBeVisible();
	await page.getByText('Прието име', { exact: true }).click();
	await expect(page.getByText('Няма растения, които отговарят на търсенето.')).toBeVisible();
});

test('editor sees the evidence panel with name check and iNaturalist link', async ({ page }) => {
	await login(page, EDITOR);
	await gotoSettled(page, plantUrl);
	await expect(page.getByRole('heading', { name: 'Доказателства' })).toBeVisible();
	await expect(page.getByText('Името не е проверено в GBIF.')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Провери името в GBIF' })).toBeVisible();
	await expect(page.getByLabel('Линк към наблюдение в iNaturalist')).toBeVisible();
	// e2e runs with FLORA_OFFLINE_EXTERNAL=1, so GBIF is unreachable and the failure is reported without writing.
	await page.getByRole('button', { name: 'Провери името в GBIF' }).click();
	await expect(page.getByRole('alert')).toHaveText('Името не можа да се провери в GBIF.');
	await logout(page);
});

test('viewer can read but cannot change anything', async ({ page }) => {
	await login(page, VIEWER);
	await expect(page.getByRole('link', { name: '+ Растение' })).toHaveCount(0);
	await page.getByRole('link', { name: /Обикновена паричка/ }).click();
	await expect(page.getByRole('heading', { name: 'Обикновена паричка' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Редактирай' })).toHaveCount(0);
	await expect(page.getByRole('heading', { name: 'Доказателства' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Провери името в GBIF' })).toHaveCount(0);
	await expect(page.getByLabel('Линк към наблюдение в iNaturalist')).toHaveCount(0);
	await expect(page.getByRole('button', { name: /Потвърди|Върни като непотвърдено/ })).toHaveCount(0);
	await expect(page.getByText('Чернова', { exact: true }).first()).toBeVisible();

	const newPage = await page.goto('/plants/new');
	expect(newPage?.status()).toBe(403);
	const editPage = await page.goto(`${plantUrl}/edit`);
	expect(editPage?.status()).toBe(403);

	const post = await page.request.post(`${plantUrl}/edit?/update`, {
		form: { scientific_name: 'Hacked', name_bg: 'Хакната' },
		headers: { origin: 'http://localhost:5174' }
	});
	expect(post.status()).toBe(403);
	const confirm = await page.request.post(`${plantUrl}?/unconfirm`, { form: {}, headers: { origin: 'http://localhost:5174' } });
	expect(confirm.status()).toBeGreaterThanOrEqual(400);
	expect(confirm.status()).toBeLessThan(500);

	await gotoSettled(page, plantUrl);
	await expect(page.getByRole('heading', { name: 'Обикновена паричка' })).toBeVisible();
	await expect(page.getByText('Чернова', { exact: true }).first()).toBeVisible();
	const stored = await adminClient().from('plants').select('name_bg, name_source').eq('id', plantId()).single();
	expect(stored.data).toEqual({ name_bg: 'Обикновена паричка', name_source: 'manual' });
	await logout(page);
});

test('editor deletes the plant with all its photos', async ({ page }) => {
	await login(page, EDITOR);
	await gotoSettled(page, `${plantUrl}/edit`);
	await page.getByRole('button', { name: 'Изтрий растението' }).click();
	await page.getByRole('button', { name: 'Да, изтрий завинаги' }).click();
	await expect(page.getByText('Още няма растения.')).toBeVisible();
	const admin = adminClient();
	const { count } = await admin.from('plant_photos').select('*', { count: 'exact', head: true });
	expect(count).toBe(0);
	const { data: owner } = await admin.auth.admin.listUsers({ perPage: 1000 });
	const ownerId = owner?.users.find((u) => u.email === EDITOR.email)?.id;
	expect(ownerId).toBeTruthy();
	const folder = await admin.storage.from('photos').list(`${ownerId}/${plantId()}`);
	expect(folder.error).toBeNull();
	expect(folder.data).toEqual([]);
});

const IDENTIFY_URL = '**/api/identify';
const identifyOk = readFileSync('tests/e2e/fixtures/identify-ok.json', 'utf8');
let aiPlantUrl = '';

test('AI suggestions fill the name when adding a plant and are stored with the plant', async ({ page }) => {
	await page.route(IDENTIFY_URL, (route) =>
		route.fulfill({ status: 200, contentType: 'application/json', body: identifyOk })
	);
	await login(page, EDITOR);
	await page.getByRole('link', { name: '+ Растение' }).click();
	await page.getByLabel('Снимки', { exact: true }).setInputFiles([fixture('leaf-a.jpg')]);
	await expect(page.getByText('Bellis perennis')).toBeVisible({ timeout: 30_000 });
	await expect(page.getByText('71 %')).toBeVisible();
	await expect(page.getByText('Разпознаването използва Pl@ntNet API.')).toBeVisible();

	await page.getByRole('button', { name: /Bellis perennis/ }).click();
	await expect(page.getByLabel('Латинско име')).toHaveValue('Bellis perennis');
	await expect(page.getByLabel('Семейство')).toHaveValue('Asteraceae');
	await page.getByLabel('Българско име').fill('Паричка');
	await page.getByRole('button', { name: 'Запази растението' }).click();

	await expect(page.getByRole('heading', { name: 'Паричка' })).toBeVisible({ timeout: 30_000 });
	aiPlantUrl = new URL(page.url()).pathname;
	// e2e runs with FLORA_OFFLINE_EXTERNAL=1, so GBIF cannot confirm the name: AI draft, not AI + GBIF.
	await expect(page.getByText('AI чернова', { exact: true }).first()).toBeVisible();

	const id = aiPlantUrl.split('/').pop()!;
	const admin = adminClient();
	const stored = await admin.from('identifications').select('chosen_index, photo_count, candidates').eq('plant_id', id);
	expect(stored.data).toHaveLength(1);
	expect(stored.data?.[0]).toMatchObject({ chosen_index: 0, photo_count: 1 });
	expect((stored.data?.[0].candidates as unknown[]).length).toBe(2);
	const plant = await admin.from('plants').select('name_source, scientific_name').eq('id', id).single();
	expect(plant.data).toEqual({ name_source: 'ai', scientific_name: 'Bellis perennis' });
});

test('AI suggestions can be requested from the saved photos when editing', async ({ page }) => {
	await page.route(IDENTIFY_URL, (route) =>
		route.fulfill({ status: 200, contentType: 'application/json', body: identifyOk })
	);
	await login(page, EDITOR);
	await gotoSettled(page, `${aiPlantUrl}/edit`);
	await page.getByRole('button', { name: 'Разпознай по снимките' }).click();
	await expect(page.getByText('Bellis sylvestris')).toBeVisible({ timeout: 30_000 });
	await page.getByRole('button', { name: /Bellis sylvestris/ }).click();
	await expect(page.getByLabel('Латинско име')).toHaveValue('Bellis sylvestris');
	await page.getByRole('button', { name: 'Запази', exact: true }).click();
	await expect(page.getByText('Bellis sylvestris').first()).toBeVisible();
	await expect(page.getByText('AI чернова', { exact: true }).first()).toBeVisible();

	const id = aiPlantUrl.split('/').pop()!;
	const admin = adminClient();
	const rows = await admin.from('identifications').select('chosen_index').eq('plant_id', id);
	expect(rows.data).toHaveLength(2);
	const plant = await admin.from('plants').select('name_source').eq('id', id).single();
	expect(plant.data).toEqual({ name_source: 'ai' });
	await logout(page);
});

test('identify button stays locked while AI is thinking', async ({ page }) => {
	let calls = 0;
	await page.route(IDENTIFY_URL, async (route) => {
		calls += 1;
		await new Promise((resolve) => setTimeout(resolve, 1500));
		await route.fulfill({ status: 200, contentType: 'application/json', body: identifyOk });
	});
	await login(page, EDITOR);
	await gotoSettled(page, `${aiPlantUrl}/edit`);
	const button = page.getByRole('button', { name: /Разпознай по снимките|Зареждане на снимките/ });
	await button.click();
	await expect(page.getByText('Разпознаване…')).toBeVisible({ timeout: 30_000 });
	await expect(button).toBeDisabled();
	await button.click({ force: true });
	await expect(page.getByText('Bellis perennis')).toBeVisible({ timeout: 30_000 });
	await expect(button).toBeEnabled();
	expect(calls).toBe(1);
	await logout(page);
});

test('status stamp text is at least 11px and stays inside the ring', async ({ page }) => {
	await page.setViewportSize({ width: 360, height: 780 });
	await login(page, EDITOR);
	const measure = () =>
		page.locator('.stamp').evaluate((el) => {
			const label = el.lastElementChild as HTMLElement;
			return {
				size: parseFloat(getComputedStyle(label).fontSize),
				fits: el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight
			};
		});
	await gotoSettled(page, aiPlantUrl);
	expect(await measure()).toEqual({ size: expect.any(Number), fits: true });
	expect((await measure()).size).toBeGreaterThanOrEqual(11);

	// The longest label ("Потвърдено · iNaturalist") is the hardest case.
	const id = aiPlantUrl.split('/').pop()!;
	const admin = adminClient();
	const plant = await admin.from('plants').select('scientific_name').eq('id', id).single();
	await admin
		.from('plants')
		.update({ inat_quality_grade: 'research', inat_taxon_name: plant.data!.scientific_name, inat_observation_id: 1 })
		.eq('id', id);
	await gotoSettled(page, aiPlantUrl);
	await expect(page.locator('.stamp')).toContainText('Потвърдено');
	const community = await measure();
	expect(community.fits).toBe(true);
	expect(community.size).toBeGreaterThanOrEqual(11);
	await logout(page);
});

test('a missing AI configuration is explained and the plant still saves', async ({ page }) => {
	await page.route(IDENTIFY_URL, (route) =>
		route.fulfill({
			status: 503,
			contentType: 'application/json',
			body: JSON.stringify({ ok: false, code: 'not_configured', message: 'AI разпознаването не е настроено.' })
		})
	);
	await login(page, EDITOR);
	await page.getByRole('link', { name: '+ Растение' }).click();
	await page.getByLabel('Снимки', { exact: true }).setInputFiles([fixture('leaf-b.jpg')]);
	await expect(page.getByText('AI разпознаването не е настроено.')).toBeVisible({ timeout: 30_000 });
	await page.getByLabel('Българско име').fill('Маргаритка');
	await page.getByLabel('Латинско име').fill('Leucanthemum vulgare');
	await page.getByRole('button', { name: 'Запази растението' }).click();
	await expect(page.getByRole('heading', { name: 'Маргаритка' })).toBeVisible({ timeout: 30_000 });
	await expect(page.getByText('Чернова', { exact: true }).first()).toBeVisible();

	const id = new URL(page.url()).pathname.split('/').pop()!;
	const admin = adminClient();
	const { count } = await admin.from('identifications').select('*', { count: 'exact', head: true }).eq('plant_id', id);
	expect(count).toBe(0);
	const plant = await admin.from('plants').select('name_source').eq('id', id).single();
	expect(plant.data).toEqual({ name_source: 'manual' });
	await logout(page);
});

test('clearing the photos drops the AI suggestions and saves no identification', async ({ page }) => {
	await page.route(IDENTIFY_URL, (route) =>
		route.fulfill({ status: 200, contentType: 'application/json', body: identifyOk })
	);
	await login(page, EDITOR);
	await page.getByRole('link', { name: '+ Растение' }).click();
	const input = page.getByLabel('Снимки', { exact: true });
	await input.setInputFiles([fixture('leaf-a.jpg')]);
	await expect(page.getByText('Bellis perennis')).toBeVisible({ timeout: 30_000 });
	await input.setInputFiles([]);
	await expect(page.getByText('Bellis perennis')).toBeHidden();
	await page.getByLabel('Българско име').fill('Изчистено');
	await page.getByLabel('Латинско име').fill('Bellis sp.');
	await page.getByRole('button', { name: 'Запази растението' }).click();
	await expect(page.getByRole('heading', { name: 'Изчистено' })).toBeVisible({ timeout: 30_000 });

	const id = new URL(page.url()).pathname.split('/').pop()!;
	const admin = adminClient();
	const { count } = await admin.from('identifications').select('*', { count: 'exact', head: true }).eq('plant_id', id);
	expect(count).toBe(0);
	const plant = await admin.from('plants').select('name_source').eq('id', id).single();
	expect(plant.data).toEqual({ name_source: 'manual' });
	await logout(page);
});

async function legacyPlantWithPhoto(name: string, file: string, extra: Record<string, unknown> = {}) {
	const admin = adminClient();
	const ownerId = await ensureUser(EDITOR, { editor: true });
	const plantId = randomUUID();
	const photoId = randomUUID();
	const { error } = await admin
		.from('plants')
		.insert({ id: plantId, owner_id: ownerId, scientific_name: name, name_bg: `Старо ${name}`, name_source: 'legacy_ai', ...extra });
	if (error) throw error;
	const bytes = readFileSync(fixture(file));
	const path = `${ownerId}/${plantId}/${photoId}.jpg`;
	const thumb = `${ownerId}/${plantId}/${photoId}_thumb.jpg`;
	for (const p of [path, thumb]) {
		const up = await admin.storage.from('photos').upload(p, bytes, { contentType: 'image/jpeg' });
		if (up.error) throw up.error;
	}
	const photo = await admin.from('plant_photos').insert({
		id: photoId,
		plant_id: plantId,
		owner_id: ownerId,
		path,
		thumb_path: thumb,
		mime: 'image/jpeg',
		width: 100,
		height: 100,
		bytes: bytes.length,
		sha256: createHash('sha256').update(bytes).update(plantId).digest('hex'),
		is_primary: true
	});
	if (photo.error) throw photo.error;
	return plantId;
}

test('editor reviews legacy plants', async ({ page }) => {
	await resetCatalog();
	const aster = await legacyPlantWithPhoto('Aster amellus', 'leaf-a.jpg');
	const bellis = await legacyPlantWithPhoto('Bellis perennis', 'leaf-b.jpg', { gbif_match: 'accepted', gbif_key: 3117813, gbif_accepted_key: 3117813 });
	await legacyPlantWithPhoto('Crocus sp.', 'rotated.jpg');

	const replies = [
		{ ok: true, modelVersion: 'v', candidates: [{ scientific_name: 'Erigeron annuus', authorship: null, family: 'Asteraceae', genus: 'Erigeron', common_names: [], score: 0.6, gbif_key: 3117424 }] },
		JSON.parse(identifyOk),
		{ ok: false, code: 'no_match', message: 'AI не разпозна растението. Попълни името сам.' }
	];
	let calls = 0;
	await page.route(IDENTIFY_URL, (route) =>
		route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(replies[calls++]) })
	);
	await login(page, EDITOR);
	await page.getByRole('link', { name: /За преглед/ }).click();
	await page.getByRole('button', { name: 'Подготви прегледа' }).click();
	await expect(page.getByText('Готово.')).toBeVisible({ timeout: 60_000 });
	expect(calls).toBe(3);

	await expect(page.getByRole('heading', { name: /Не съвпадат/ })).toBeVisible();
	await expect(page.getByRole('heading', { name: /Съвпадат/ })).toBeVisible();
	await expect(page.getByRole('heading', { name: /Без резултат/ })).toBeVisible();

	await page.getByRole('button', { name: 'Приеми всички 1 съвпадения' }).click();
	await page.getByRole('button', { name: 'Потвърди' }).click();
	await expect(page.getByRole('heading', { name: /Съвпадат/ })).toBeHidden();

	const item = (name: string) => page.getByRole('article').filter({ hasText: name });
	await item('Aster amellus').getByRole('button', { name: 'Остави старото' }).click();
	await expect(page.getByRole('heading', { name: /Не съвпадат/ })).toBeHidden();
	await item('Crocus sp.').getByRole('button', { name: 'Остави старото' }).click();
	await expect(page.getByRole('heading', { name: /Без резултат/ })).toBeHidden();
	await expect(page.getByText('Няма нищо за преглед.')).toBeVisible();

	const admin = adminClient();
	const decisions = await admin.from('identifications').select('plant_id, decision').eq('source', 'review');
	expect(decisions.data).toHaveLength(3);
	expect(decisions.data!.find((d) => d.plant_id === bellis)?.decision).toBe('match');
	expect(decisions.data!.find((d) => d.plant_id === aster)?.decision).toBe('kept');
	expect(decisions.data!.filter((d) => d.decision === 'kept')).toHaveLength(2);

	await gotoSettled(page, `/plants/${bellis}`);
	await expect(page.locator('.stamp')).toContainText('AI · прието име');
	await logout(page);
});

test('viewer does not see the review', async ({ page }) => {
	await login(page, VIEWER);
	await expect(page.getByRole('link', { name: /За преглед/ })).toHaveCount(0);
	const response = await page.goto('/review');
	expect(response?.status()).toBe(404);
	await logout(page);
});

// Runs last: the first test above expects an empty catalog, so this block starts from a clean
// catalog of its own and removes its plants afterwards.
test.describe('catalog pages of 15 / 30 / 45', () => {
	const ids: string[] = [];
	const cards = (page: Page) => page.getByRole('list', { name: 'Растения' }).getByRole('listitem');
	const pages = (page: Page) => page.getByRole('navigation', { name: 'Страници' });

	test.beforeAll(async () => {
		await resetCatalog();
		const ownerId = await ensureUser(EDITOR, { editor: true });
		const rows = Array.from({ length: 31 }, (_, i) => {
			const n = String(i + 1).padStart(2, '0');
			return { id: randomUUID(), name_bg: `Тест ${n}`, scientific_name: `Testus ${n}`, owner_id: ownerId };
		});
		const { error } = await adminClient().from('plants').insert(rows);
		if (error) throw error;
		ids.push(...rows.map((row) => row.id));
	});

	test.afterAll(async () => {
		const { error } = await adminClient().from('plants').delete().in('id', ids);
		if (error) throw error;
	});

	test('shows 15, 30 or 45 plants per page and keeps the page in the URL', async ({ page }) => {
		await login(page, EDITOR);

		await gotoSettled(page, '/');
		await expect(cards(page)).toHaveCount(15);
		await expect(pages(page).getByRole('link', { name: '15', exact: true })).toHaveAttribute('aria-current', 'true');
		await expect(pages(page).getByRole('link', { name: '1', exact: true })).toHaveAttribute('aria-current', 'page');
		await expect(pages(page).getByRole('link', { name: '2', exact: true })).not.toHaveAttribute('aria-current');

		await pages(page).getByRole('link', { name: '3', exact: true }).click();
		await expect(cards(page)).toHaveCount(1);
		await expect(page).toHaveURL(/[?&]p=3/);
		await expect(cards(page).first()).toContainText('Тест 31');

		await pages(page).getByRole('link', { name: '30', exact: true }).click();
		await expect(cards(page)).toHaveCount(30);
		await expect(page).toHaveURL(/[?&]n=30/);
		await expect(page).not.toHaveURL(/[?&]p=/);

		await pages(page).getByRole('link', { name: '45', exact: true }).click();
		await expect(cards(page)).toHaveCount(31);
		await expect(page).toHaveURL(/[?&]n=45/);
		await expect(pages(page).getByRole('link', { name: '45', exact: true })).toHaveAttribute('aria-current', 'true');
		await expect(pages(page).getByRole('list')).toHaveCount(0);

		await gotoSettled(page, '/?n=15&p=2');
		await expect(page).toHaveURL(/[?&]p=2/);
		await page.getByLabel('Търси').fill('Тест 31');
		await expect(page).not.toHaveURL(/[?&]p=/);
		await expect(page).toHaveURL(/[?&]q=/);
		await expect(cards(page)).toHaveCount(1);
		await expect(cards(page).first()).toContainText('Тест 31');
		await expect(page.getByLabel('Търси')).toHaveValue('Тест 31');

		// Old links with the former sizes fall back to 15.
		await gotoSettled(page, '/?n=12&p=99');
		await expect(pages(page).getByRole('link', { name: '15', exact: true })).toHaveAttribute('aria-current', 'true');
		await expect(cards(page)).toHaveCount(1);
		await expect(pages(page).getByRole('link', { name: '3', exact: true })).toHaveAttribute('aria-current', 'page');
	});
});

// Runs after the paging block; again starts from a clean catalog and removes its plants afterwards.
test.describe('family index', () => {
	const ids: string[] = [];
	const cards = (page: Page) => page.getByRole('list', { name: 'Растения' }).getByRole('listitem');
	const families = (page: Page) => page.getByRole('list', { name: 'Семейства' }).getByRole('listitem');

	test.beforeAll(async () => {
		await resetCatalog();
		const ownerId = await ensureUser(EDITOR, { editor: true });
		const rows = [
			{ name_bg: 'Лайка', scientific_name: 'Matricaria chamomilla', family: 'Asteraceae (Сложноцветни)' },
			{ name_bg: 'Глухарче', scientific_name: 'Taraxacum officinale', family: 'Asteraceae (Сложноцветни)' },
			{ name_bg: 'Равнец', scientific_name: 'Achillea millefolium', family: 'Asteraceae' },
			{ name_bg: 'Мащерка', scientific_name: 'Thymus serpyllum', family: 'Lamiaceae (Устноцветни)' },
			{ name_bg: 'Неизвестно', scientific_name: 'Plantae sp.', family: null }
		].map((row) => ({ ...row, id: randomUUID(), owner_id: ownerId }));
		const { error } = await adminClient().from('plants').insert(rows);
		if (error) throw error;
		ids.push(...rows.map((row) => row.id));
	});

	test.afterAll(async () => {
		const { error } = await adminClient().from('plants').delete().in('id', ids);
		if (error) throw error;
	});

	test('lists families on one screen and filters the catalog by one', async ({ page }) => {
		await login(page, EDITOR);
		await gotoSettled(page, '/');
		await expect(cards(page)).toHaveCount(5);

		await page.getByRole('link', { name: 'Семейства' }).click();
		await expect(page).toHaveURL(/[?&]v=fam/);
		await expect(families(page)).toHaveCount(2);
		await expect(families(page).first()).toContainText('Asteraceae');
		await expect(families(page).first()).toContainText('Сложноцветни');
		await expect(families(page).first()).toContainText('3');
		await expect(cards(page)).toHaveCount(0);

		await families(page).first().getByRole('link').click();
		await expect(page).toHaveURL(/[?&]f=Asteraceae/);
		await expect(page).not.toHaveURL(/[?&]v=fam/);
		await expect(cards(page)).toHaveCount(3);
		await expect(page.getByText('Семейство: Asteraceae · Сложноцветни')).toBeVisible();

		await page.getByRole('link', { name: 'Махни филтъра за семейство' }).click();
		await expect(page).not.toHaveURL(/[?&]f=/);
		await expect(cards(page)).toHaveCount(5);

		// The family filter works together with search and keeps the page size.
		// "ка" matches Лайка (Asteraceae) and Мащерка (Lamiaceae); the family filter keeps only Лайка.
		await gotoSettled(page, '/?q=ка&n=30');
		await expect(cards(page)).toHaveCount(2);
		await gotoSettled(page, '/?f=Asteraceae&n=30');
		await page.getByLabel('Търси').fill('ка');
		await expect(cards(page)).toHaveCount(1);
		await expect(cards(page).first()).toContainText('Лайка');
		await expect(page).toHaveURL(/[?&]f=Asteraceae/);
		await expect(page).toHaveURL(/[?&]n=30/);
	});
});

test.describe('light and dark theme', () => {
	test('follows the system and switches with the header button, remembered after reload', async ({ browser }) => {
		const context = await browser.newContext({ colorScheme: 'dark', viewport: { width: 412, height: 915 } });
		const page = await context.newPage();
		await login(page, EDITOR);
		const html = page.locator('html');
		const toggle = page.getByRole('button', { name: /Светъл режим|Тъмен режим/ });

		// No saved choice: the system dark scheme gives the dark green palette.
		await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(19, 42, 30)');
		await expect(toggle).toHaveAccessibleName('Светъл режим');

		await toggle.click();
		await expect(html).toHaveAttribute('data-theme', 'light');
		await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(237, 242, 234)');
		await expect(toggle).toHaveAccessibleName('Тъмен режим');

		await page.reload();
		await page.waitForLoadState('networkidle');
		await expect(html).toHaveAttribute('data-theme', 'light');
		await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(237, 242, 234)');

		await page.getByRole('button', { name: 'Тъмен режим' }).click();
		await expect(html).toHaveAttribute('data-theme', 'dark');
		await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(19, 42, 30)');
		await context.close();
	});
});
