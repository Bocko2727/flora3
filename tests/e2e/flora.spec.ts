import { expect, test, type Page } from '@playwright/test';
import { EDITOR, VIEWER, adminClient, type TestUser } from '../helpers/supabase';

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
	await page.getByLabel('Снимки (по желание)').setInputFiles([fixture('leaf-a.jpg'), fixture('leaf-b.jpg')]);
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
