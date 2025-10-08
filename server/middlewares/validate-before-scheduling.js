import { errors } from '@strapi/utils';

const validationMiddleware = async (context, next) => {
	const { uid, action, params } = context;
	// Run this middleware only for the publisher action.
	if (uid !== 'plugin::publisher.action') return next();

	// Run it only for the create and update actions.
	if (action !== 'create' && action !== 'update') return next();

	// The create action will have the data directly.
	let publisherAction = params?.data;

	// The update action might have incomplete data, so we need to fetch it.
	if (action === 'update') {
		publisherAction = await strapi.documents('plugin::publisher.action').findOne({
			documentId: params.documentId,
		});
	}

	// The complete, and possibly updated, publisher action.
	const { entityId, entitySlug, mode, locale: actionLocale } = {
		...publisherAction,
		...params?.data,
	};

	// Run it only for the publish mode.
	if (mode !== 'publish') return next();

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
			`No draft found for ${entitySlug} with documentId "${entityId}"${
				actionLocale ? ` and locale "${actionLocale}".` : '.'
			}`
		);
	}

	// If no locale was provided in params.data, fill it in from the draft.
	const locale = actionLocale || draft.locale;

	// Fetch the published entity in this same locale.
	const published = await strapi.documents(entitySlug).findOne({
		documentId: entityId,
		status: 'published',
		locale,
		populate,
	});

	const model = strapi.contentType(entitySlug);

	// ---------- helpers ----------
	const isEmptyValue = (value, { multiple, repeatable }) => {
		if (multiple || repeatable) return !Array.isArray(value) || value.length === 0;
		return value === null || value === undefined;
	};

	// Minimal custom check: only required media/relations + nested structure inside components/DZ.
	const collectRequiredMissing = (schema, dataNode, pathArr = []) => {
		const errs = [];
		const attrs = schema?.attributes || {};

		for (const [name, attr] of Object.entries(attrs)) {
			const nextPath = [...pathArr, name];
			const value = dataNode ? dataNode[name] : undefined;

			// Media fields
			if (attr.type === 'media') {
				if (attr.required && isEmptyValue(value, { multiple: !!attr.multiple })) {
					errs.push({ path: nextPath, message: 'This field is required' });
				}
				continue;
			}

			// Relations
			if (attr.type === 'relation') {
				const many =
					['oneToMany', 'manyToMany', 'morphToMany'].includes(attr.relation) ||
					(typeof attr.relation === 'string' && attr.relation.toLowerCase().includes('many'));
				if (attr.required && isEmptyValue(value, { multiple: many })) {
					errs.push({ path: nextPath, message: 'This field is required' });
				}
				continue;
			}

			// Components (repeatable or single)
			if (attr.type === 'component') {
				if (attr.required && isEmptyValue(value, { repeatable: !!attr.repeatable })) {
					errs.push({ path: nextPath, message: 'This field is required' });
					continue;
				}
				const compSchema = strapi.components[attr.component];
				if (attr.repeatable && Array.isArray(value)) {
					value.forEach((item, idx) => {
						errs.push(...collectRequiredMissing(compSchema, item, [...nextPath, idx]));
					});
				} else if (value) {
					errs.push(...collectRequiredMissing(compSchema, value, nextPath));
				}
				continue;
			}

			// Dynamic zones
			if (attr.type === 'dynamiczone') {
				if (attr.required && (!Array.isArray(value) || value.length === 0)) {
					errs.push({ path: nextPath, message: 'This field is required' });
					continue;
				}
				if (Array.isArray(value)) {
					value.forEach((dzItem, idx) => {
						const compUid = dzItem?.__component;
						if (!compUid) return;
						const compSchema = strapi.components[compUid];
						errs.push(...collectRequiredMissing(compSchema, dzItem, [...nextPath, idx]));
					});
				}
				continue;
			}
		}

		return errs;
	};

	// ---------- run core validator, normalize, and (optionally) add extras ----------
	try {
		await strapi.entityValidator.validateEntityCreation(
			model,
			draft,
			{ isDraft: false, locale },
			published
		);
	} catch (e) {
		const name = e?.name || e?.constructor?.name;
		const isValidationLike =
			Array.isArray(e?.details?.errors) || /ValidationError/i.test(name || '');

		if (isValidationLike) {
			// Use core errors and supplement with missing media/relations if needed.
			const core = (e.details?.errors || []).map((er) => ({
				path: er.path || er.name || '',
				message: er.message || 'This field is required',
			}));
			const extras = collectRequiredMissing(model, draft);
			const merged = [...core, ...extras];

			throw new errors.ValidationError(
				'There are validation errors in your document. Please fix them so you can publish.',
				{ errors: merged }
			);
		}

		throw e;
	}

	// Enforce required media/relations even if core validator passed
	const extrasAfterPass = collectRequiredMissing(model, draft);
	if (extrasAfterPass.length > 0) {
		throw new errors.ValidationError(
			'There are validation errors in your document. Please fix them so you can publish.',
			{ errors: extrasAfterPass }
		);
	}

	return next();
};

export default validationMiddleware;
