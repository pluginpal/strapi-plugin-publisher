module.exports = {
	$schema: 'https://json.schemastore.org/eslintrc',
	env: {
		es6: true,
		node: true,
	},
	parserOptions: {
		ecmaVersion: 2020,
		sourceType: 'module',
	},
	extends: ['eslint:recommended', 'plugin:node/recommended', 'prettier'],
	rules: {
		'node/no-unsupported-features/es-syntax': 'off',
		'node/no-extraneous-require': [
			'error',
			{
				allowModules: ['yup', 'lodash', '@strapi/utils'],
			},
		],
	},
};
