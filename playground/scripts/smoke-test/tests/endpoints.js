const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { BASE_URL } = require('../lib/config');
const { api } = require('../lib/client');

describe('Endpoints', () => {
	it('serves the admin panel', async () => {
		const response = await fetch(`${BASE_URL}/admin`);
		assert.ok(response.ok, `GET /admin returned ${response.status}`);
		assert.match(await response.text(), /<script/);
	});

	it('returns the plugin settings', async () => {
		const settings = await api('GET', '/publisher/settings');
		assert.ok(
			settings?.data?.components?.dateTimePicker,
			'GET /publisher/settings did not return the plugin config'
		);
	});
});
