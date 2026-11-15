import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		environment: 'node',
		include: ['tests/**/*.test.js'],
		setupFiles: ['tests/setup.js'],
		restoreMocks: true,
		coverage: {
			provider: 'v8',
			include: ['server/**/*.js', 'admin/src/utils/**/*.ts'],
			reporter: ['text', 'html'],
		},
	},
});
