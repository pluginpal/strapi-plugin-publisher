import { errors } from '@strapi/utils';

const validationMiddleware = async (context, next) => {
	const { uid, action, params } = context;
	// Run this middleware only for the publisher action.
	if (uid !== 'plugin::publisher.action') {
		return next();
	}

	// Run it only for the create and update actions.
	if (action !== 'create' && action !== 'update') {
		return next();
	}

	// The create action will have the data directly.
	let publisherAction = params.data;

	// The update action might have incomplete data, so we need to fetch it.
	if (action === 'update') {
		publisherAction = await strapi.documents('plugin::publisher.action').findOne({
			documentId: params.documentId,
		});
	}

	// The complete, and possibly updated, publisher action.
	const { entityId, entitySlug, mode, locale: actionLocale } = {
		...publisherAction,
		...params.data,
	};

	// Run it only for the publish mode.
	if (mode !== 'publish') {
		return next();
	}

	// Determine the final locale: use the provided locale first, otherwise fall back to the draft’s locale.
	const draft = await strapi.documents(entitySlug).findOne({
		documentId: entityId,
		status: 'draft',
		locale: actionLocale,
		populate: '*',
	});

	if (!draft) {
		throw new errors.NotFoundError(
			`No draft found for ${entitySlug} with documentId "${entityId}"${actionLocale ? ` and locale "${actionLocale}".` : '.'}`
		);
	}

	// If no locale was provided in params.data, fill it in from the draft
	const locale = actionLocale || draft.locale;

	// Fetch the published entity in this same locale
	const published = await strapi.documents(entitySlug).findOne({
		documentId: entityId,
		status: 'published',
		locale,
		populate: '*',
	});

	// Validate the draft before scheduling the publication.
	await strapi.entityValidator.validateEntityCreation(
		strapi.contentType(entitySlug),
		draft,
		{ isDraft: false, locale },
		published
	);

	return next();
};

export default validationMiddleware;
