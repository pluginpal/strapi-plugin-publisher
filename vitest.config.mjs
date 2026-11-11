import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		environment: 'node',
		include: ['tests/**/*.test.js'],
		restoreMocks: true,
		coverage: {
			provider: 'v8',
			include: ['server/**/*.js'],
			reporter: ['text', 'html'],
		},
	},
});
