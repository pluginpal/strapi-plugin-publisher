module.exports = ({ env }) => ({
	// Playground only: never reuse these secrets outside of local development.
	auth: {
		secret: env('ADMIN_JWT_SECRET', 'playground-admin-jwt-secret'),
	},
	apiToken: {
		salt: env('API_TOKEN_SALT', 'playground-api-token-salt'),
	},
	transfer: {
		token: {
			salt: env('TRANSFER_TOKEN_SALT', 'playground-transfer-token-salt'),
		},
	},
	secrets: {
		encryptionKey: env('ENCRYPTION_KEY', 'playground-encryption-key'),
	},
});
