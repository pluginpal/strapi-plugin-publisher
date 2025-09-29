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

	const populateBuilderService = strapi.plugin('content-manager').service('populate-builder');
	const populate = await populateBuilderService(entitySlug).populateDeep(Infinity).build();

	// Determine the final locale: use the provided locale first, otherwise fall back to the draft’s locale.
	const draft = await strapi.documents(entitySlug).findOne({
		documentId: entityId,
		status: 'draft',
		locale: actionLocale,
		populate,
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
		populate,
	});

	// -------------------------
	// Extra validation for media and relations
	// -------------------------
	const isEmptyValue = (value, { multiple, repeatable }) => {
		if (multiple || repeatable) {
			return !Array.isArray(value) || value.length === 0;
		}
		return value === null || value === undefined;
	};

	const contentType = strapi.contentType(entitySlug);

	// Recursively validate required relations
	const validateRequiredRelations = (schema, dataNode, path = '') => {
		const errs = [];
		const attrs = schema.attributes || {};

		for (const [name, attr] of Object.entries(attrs)) {
			const currentPath = path ? `${path}.${name}` : name;
			const value = dataNode ? dataNode[name] : undefined;

			// media
			if (attr.type === 'media') {
				if (attr.required && isEmptyValue(value, { multiple: !!attr.multiple })) {
					errs.push(`Field "${currentPath}" (media) is required`);
				}
				continue;
			}

			// relation
			if (attr.type === 'relation') {
				if (attr.required && isEmptyValue(value, { multiple: attr.relation === 'oneToMany' || attr.relation === 'manyToMany' || attr.relation === 'morphToMany' })) {
					errs.push(`Field "${currentPath}" (relation) is required`);
				}
				continue;
			}

			// component
			if (attr.type === 'component') {
				if (attr.required && isEmptyValue(value, { repeatable: !!attr.repeatable })) {
					errs.push(`Field "${currentPath}" (component${attr.repeatable ? '[]' : ''}) is required`);
					continue;
				}
				// Recurse into component(s)
				const componentSchema = strapi.components[attr.component];
				if (attr.repeatable) {
					if (Array.isArray(value)) {
						value.forEach((item, idx) => {
							errs.push(
								...validateRequiredRelations(componentSchema, item, `${currentPath}[${idx}]`)
							);
						});
					}
				} else if (value) {
					errs.push(
						...validateRequiredRelations(componentSchema, value, currentPath)
					);
				}
				continue;
			}

			// dynamic zone
			if (attr.type === 'dynamiczone') {
				if (attr.required && (!Array.isArray(value) || value.length === 0)) {
					errs.push(`Field "${currentPath}" (dynamic zone) is required`);
					continue;
				}
				if (Array.isArray(value)) {
					value.forEach((dzItem, idx) => {
						const compUid = dzItem && dzItem.__component;
						if (!compUid) return;
						const compSchema = strapi.components[compUid];
						errs.push(
							...validateRequiredRelations(compSchema, dzItem, `${currentPath}[${idx}]`)
						);
					});
				}
				continue;
			}
		}

		return errs;
	};

	const relationErrors = validateRequiredRelations(contentType, draft);
	if (relationErrors.length > 0) {
		throw new errors.ValidationError(
			`Cannot schedule publish: missing required relation/media fields.\n` +
			relationErrors.map((e) => `- ${e}`).join('\n')
		);
	}
	await strapi.entityValidator.validateEntityCreation(
		contentType,
		draft,
		{ isDraft: false, locale },
		published
	);

	return next();
};

export default validationMiddleware;
