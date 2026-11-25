import { describe, expect, it } from 'vitest';
import { getActionParams, getActionQueryKey } from '../../admin/src/utils/actionQuery';

const lookup = { mode: 'publish', entityId: 'article-1', entitySlug: 'api::article.article' };

describe('looking up the action of an entry in the admin', () => {
	it('asks for the action of the current locale of a localized entry', () => {
		expect(getActionParams({ ...lookup, locale: 'nl' })).toEqual({ filters: lookup, locale: 'nl' });
	});

	it.each([null, undefined, ''])('does not send a locale without i18n (%s)', (locale) => {
		expect(getActionParams({ ...lookup, locale })).toEqual({ filters: lookup });
	});

	it('caches the action per locale', () => {
		expect(getActionQueryKey({ ...lookup, locale: 'nl' })).not.toEqual(
			getActionQueryKey({ ...lookup, locale: 'en' })
		);
	});

	it('refreshes all locales of an entry after a change', () => {
		const forAllLocales = getActionQueryKey(lookup);
		const forDutch = getActionQueryKey({ ...lookup, locale: 'nl' });

		// react-query invalidates every key that starts with the given key.
		expect(forDutch.slice(0, forAllLocales.length)).toEqual(forAllLocales);
		expect(getActionQueryKey({})).toEqual(forAllLocales.slice(0, 2));
	});
});
