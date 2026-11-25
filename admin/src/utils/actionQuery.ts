import { pluginId } from '../pluginId';

type ActionLookup = {
	mode: 'publish' | 'unpublish';
	entityId: string;
	entitySlug: string;
	locale?: string | null;
};

/**
 * Query params for finding the action of one entry. Every locale of a localized entry has its
 * own action, so pass the locale when there is one. It is a separate `locale` param, handled by
 * the plugin's action controller: Strapi itself rejects `filters[locale]` for actions.
 * Content types without i18n have no locale in the URL.
 */
export const getActionParams = ({ mode, entityId, entitySlug, locale }: ActionLookup) => ({
	filters: { mode, entityId, entitySlug },
	...(locale ? { locale } : {}),
});

/**
 * react-query key for the action of one entry. Mutations invalidate the key without the locale,
 * which (as a prefix) refreshes the actions of all locales of that entry.
 */
export const getActionQueryKey = ({ mode, entityId, entitySlug, locale }: Partial<ActionLookup>) =>
	[pluginId, 'entity-action', entityId, entitySlug, mode, locale].filter(Boolean);
