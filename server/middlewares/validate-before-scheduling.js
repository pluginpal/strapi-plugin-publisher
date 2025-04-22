import { errors } from "@strapi/utils";

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
	const { entityId, entitySlug, mode } = { ...publisherAction, ...params.data };

	// Run it only for the publish mode.
	if (mode !== 'publish') {
		return next();
	}

	// Fetch the draft that will be published.
	const draft = await strapi.documents(entitySlug).findOne({
		documentId: entityId,
		status: 'draft',
		populate: '*',
	});

	// Throw an error if there is no document with the given documentId.
	if (!draft) {
		throw new errors.NotFoundError(`No entity found with documentId ${entityId} for content type ${entitySlug}`);
	}

	// Fetch the published entity.
	const published = await strapi.documents(entitySlug).findOne({
		documentId: entityId,
		status: 'published',
		populate: '*',
	});

	// Run the validations.
	await strapi.entityValidator.validateEntityCreation(
		strapi.contentType(entitySlug),
		draft,
		{
			// We put isDraft to false to validate all required fields.
			isDraft: false,
			locale: draft.locale,
		},
		// Pass the published entity to prevent unique constraint errors.
		published,
	);

  return next();
};

export default validationMiddleware;
