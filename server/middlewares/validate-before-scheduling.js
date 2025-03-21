
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
	});

	// Validate the draft before scheduling the publication.
	if (draft) {
		await strapi.entityValidator.validateEntityCreation(strapi.contentType(entitySlug), draft, {
			isDraft: false,
			locale: draft.locale,
		});
	}

  return next();
};

export default validationMiddleware;
