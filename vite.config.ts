import adapter from '@sveltejs/adapter-vercel';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter({ runtime: 'nodejs22.x' })
		})
	],
	test: {
		projects: [
			{
				extends: true,
				test: { name: 'unit', include: ['tests/unit/**/*.test.ts'], environment: 'node' }
			},
			{
				extends: true,
				test: {
					name: 'integration',
					include: ['tests/integration/**/*.test.ts'],
					environment: 'node',
					fileParallelism: false,
					testTimeout: 30_000,
					hookTimeout: 60_000
				}
			}
		]
	}
});
