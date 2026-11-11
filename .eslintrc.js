const frontendESLint = require('./.eslintrc.frontend.js');
const backendESLint = require('./.eslintrc.backend.js');

module.exports = {
	$schema: 'https://json.schemastore.org/eslintrc',
	parserOptions: {
		ecmaVersion: 2020,
	},
	rules: {
		indent: ['error', 'tab'],
		'linebreak-style': ['error', 'unix'],
		quotes: ['error', 'single'],
		semi: ['error', 'always'],
	},
	globals: {
		strapi: 'readonly',
	},
	overrides: [
		{
			files: ['server/**/*'],
			...backendESLint,
		},
		{
			files: ['admin/**/*'],
			...frontendESLint,
		},
		{
			// Vitest unit tests (ES modules with top-level await)
			files: ['tests/**/*'],
			env: { es2022: true, node: true },
			parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
			extends: ['eslint:recommended', 'prettier'],
		},
	],
};
