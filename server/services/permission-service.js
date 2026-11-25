import { errors } from '@strapi/utils';

const READ_ACTION = 'plugin::content-manager.explorer.read';

/**
 * Checks admin users' Content Manager permissions for scheduled actions, so the publisher
 * can't be used to publish or unpublish content the user isn't allowed to publish (issue #212).
 */
export default ({ strapi }) => ({
	getPermissionChecker(userAbility, uid) {
		return strapi
			.plugin('content-manager')
			.service('permission-checker')
			.create({ userAbility, model: uid });
	},

	/**
	 * The content types (with draft & publish) the user may read in the Content Manager.
	 * Used to only list actions of content types the user has access to.
	 */
	getReadableContentTypes(userAbility) {
		return Object.values(strapi.contentTypes)
			.filter((contentType) => contentType.options?.draftAndPublish)
			.map((contentType) => contentType.uid)
			.filter((uid) => userAbility.can(READ_ACTION, uid));
	},

	/**
	 * Throws unless the user may publish (which also covers unpublish) the target entity of an action.
	 *
	 * @param {object} userAbility ctx.state.userAbility of an admin request
	 * @param {object} target { entitySlug, entityId, locale } of the action
	 * @param {object} [options]
	 * @param {boolean} [options.allowMissingEntity] don't throw when the entity no longer exists
	 *   (so actions of deleted entries can still be removed)
	 */
	async assertCanSchedule(userAbility, { entitySlug, entityId, locale }, { allowMissingEntity = false } = {}) {
		const contentType = typeof entitySlug === 'string' ? strapi.contentType(entitySlug) : undefined;
		if (!contentType || !contentType.options?.draftAndPublish) {
			throw new errors.ValidationError(`"${entitySlug}" is not a content type with draft & publish enabled.`);
		}

		const permissionChecker = this.getPermissionChecker(userAbility, entitySlug);

		// Without any publish permission on the content type there is no need to load the entity.
		// PolicyError (a 403) is used because Strapi replaces the message of other ForbiddenErrors
		// with a generic "Forbidden", and the admin shows this message in a notification.
		if (permissionChecker.cannot.publish()) {
			throw new errors.PolicyError('You are not allowed to publish or unpublish this content type.');
		}

		// Conditions (e.g. "is creator") and locale restrictions are checked against the entity itself,
		// populated the same way the Content Manager does before publishing.
		const permissionQuery = await permissionChecker.sanitizedQuery.publish({});
		const populate = await strapi
			.plugin('content-manager')
			.service('populate-builder')(entitySlug)
			.populateFromQuery(permissionQuery)
			.populateDeep(Infinity)
			.build();

		// Check the locale the action is executed in: the one stored on the action
		// (publicationService.toggle), or the default locale when it has none.
		const findParams = {
			documentId: entityId,
			populate,
			...(locale ? { locale } : {}),
		};
		const entity =
			(await strapi.documents(entitySlug).findOne({ ...findParams, status: 'draft' })) ||
			(await strapi.documents(entitySlug).findOne({ ...findParams, status: 'published' }));

		if (!entity) {
			if (allowMissingEntity) {
				return;
			}
			throw new errors.NotFoundError(`Document "${entityId}" of type "${entitySlug}" was not found.`);
		}

		if (permissionChecker.cannot.publish(entity)) {
			throw new errors.PolicyError('You are not allowed to publish or unpublish this entry.');
		}
	},
});
