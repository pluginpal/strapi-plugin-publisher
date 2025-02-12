module.exports = {
	$schema: 'https://json.schemastore.org/eslintrc',
	parser: '@babel/eslint-parser',
	env: {
		browser: true,
		es6: true,
	},
	plugins: ['react'],
	extends: ['eslint:recommended', 'plugin:react/recommended', 'prettier'],
	parserOptions: {
		requireConfigFile: false,
		ecmaVersion: 2020,
		ecmaFeatures: {
			jsx: true,
		},
		sourceType: 'module',
		babelOptions: {
			presets: ['@babel/preset-react'],
		},
	},
	settings: {
		react: {
			version: 'detect',
		},
	},
};
