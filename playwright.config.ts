import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: 'tests/e2e',
	fullyParallel: false,
	workers: 1,
	retries: 0,
	globalSetup: './tests/e2e/global-setup.ts',
	use: { baseURL: 'http://localhost:5174', trace: 'retain-on-failure' },
	projects: [{ name: 'mobile-chromium', use: { ...devices['Pixel 7'] } }],
	webServer: {
		command: 'npm run dev',
		url: 'http://localhost:5174/login',
		reuseExistingServer: true,
		timeout: 120_000
	}
});
