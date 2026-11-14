/**
 * HTTP helpers for the Strapi app under test. Requests use the super admin's token unless another
 * token is passed.
 */
const { BASE_URL, ADMIN } = require('./config');

const TIMEOUT_MS = 60000;

let adminToken;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Calls `check` every second until it returns something truthy, and returns that. */
const waitFor = async (description, check, timeout = TIMEOUT_MS) => {
	const deadline = Date.now() + timeout;
	let lastError;
	while (Date.now() < deadline) {
		try {
			const result = await check();
			if (result) {
				return result;
			}
		} catch (error) {
			lastError = error;
		}
		await sleep(1000);
	}
	throw new Error(
		`Timed out waiting for ${description}${lastError ? ` (${lastError.message})` : ''}`
	);
};

/** Sends a request and returns the status and body, whatever the status is. */
const request = async (method, url, body, token = adminToken) => {
	const response = await fetch(`${BASE_URL}${url}`, {
		method,
		headers: {
			'Content-Type': 'application/json',
			...(token ? { Authorization: `Bearer ${token}` } : {}),
		},
		body: body ? JSON.stringify(body) : undefined,
	});
	const text = await response.text();
	let json;
	try {
		json = text ? JSON.parse(text) : null;
	} catch {
		json = null;
	}
	return { status: response.status, ok: response.ok, json, text };
};

/** Sends a request that must succeed and returns the JSON body. */
const api = async (method, url, body, token) => {
	const { ok, status, json, text } = await request(method, url, body, token);
	if (!ok) {
		throw new Error(`${method} ${url} returned ${status}: ${text.slice(0, 300)}`);
	}
	return json;
};

/** Logs in as the smoke test's super admin; later requests use this token by default. */
const loginAsAdmin = async () => {
	const login = await api('POST', '/admin/login', ADMIN);
	adminToken = login?.data?.token;
	if (!adminToken) {
		throw new Error(`Logging in as ${ADMIN.email} did not return a token`);
	}
};

module.exports = { waitFor, request, api, loginAsAdmin };
