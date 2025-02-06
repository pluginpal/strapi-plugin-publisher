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
	],
};
