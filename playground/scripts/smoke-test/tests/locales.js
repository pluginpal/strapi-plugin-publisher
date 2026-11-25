/**
 * Every locale of a localized entry has its own scheduled actions, which store that locale. The
 * admin side panel finds the action of the current locale with `?locale=`, which the plugin's
 * action controller turns into a filter (the action content type itself is not localized).
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { PAGE_UID } = require('../lib/config');
const { api } = require('../lib/client');
const { actionData, getPage } = require('../lib/fixtures');

const LOCALES = ['en', 'nl'];

describe('Locales', () => {
	let page;
	const actionIds = {};

	before(async () => {
		// "About us" exists in en and nl; both locales share the documentId.
		page = await getPage('About us', 'en');
		for (const locale of LOCALES) {
			const body = actionData('unpublish', page.documentId, PAGE_UID);
			body.data.locale = locale;
			// The locale is not an attribute of the action content type, so the response leaves it out;
			// the lookups below show that it is stored.
			const { data } = await api('POST', '/publisher/actions', body);
			actionIds[locale] = data.documentId;
		}
	});

	after(async () => {
		for (const documentId of Object.values(actionIds)) {
			await api('DELETE', `/publisher/actions/${documentId}`);
		}
	});

	// Same request as getAction() in admin/src/hooks/usePublisher.tsx (admin/src/utils/actionQuery.ts).
	const findActionIds = async (locale) => {
		const query = new URLSearchParams({
			'filters[mode]': 'unpublish',
			'filters[entityId]': page.documentId,
			'filters[entitySlug]': PAGE_UID,
			...(locale ? { locale } : {}),
		});
		const { data } = await api('GET', `/publisher/actions?${query}`);
		return data.map((action) => action.documentId).sort();
	};

	it('finds the action of one locale with ?locale=', async () => {
		for (const locale of LOCALES) {
			assert.deepEqual(
				await findActionIds(locale),
				[actionIds[locale]],
				`?locale=${locale} should only return the ${locale} action`
			);
		}
	});

	it('finds the actions of all locales without a locale', async () => {
		assert.deepEqual(
			await findActionIds(),
			Object.values(actionIds).sort(),
			'Without a locale, the actions of all locales should be returned'
		);
	});
});
