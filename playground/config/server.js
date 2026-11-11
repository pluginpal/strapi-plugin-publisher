module.exports = ({ env }) => ({
	host: env('HOST', '127.0.0.1'),
	port: env.int('PORT', 1337),
	app: {
		// Playground only: never reuse these keys outside of local development.
		keys: env.array('APP_KEYS', ['playgroundKeyA', 'playgroundKeyB']),
	},
});
