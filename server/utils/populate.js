'use strict';

// from https://github.com/strapi/strapi/blob/main/packages/core/content-manager/server/services/utils/populate.js
import _ from 'lodash';
import { isAnyToMany, isVisibleAttribute } from './relations';

/**
 * Populate the model for relation
 * @param {Object} attribute - Attribute containing a relation
 * @param {String} attribute.relation - type of relation
 * @param model - Model of the populated entity
 * @param attributeName
 * @param {Object} options - Options to apply while populating
 * @param {Boolean} options.countMany
 * @param {Boolean} options.countOne
 * @returns {true|{count: true}}
 */
function getPopulateForRelation(attribute, model, attributeName, { countMany, countOne }) {
	const isManyRelation = isAnyToMany(attribute);

	// always populate createdBy, updatedBy, localizations etc.
	if (!isVisibleAttribute(model, attributeName)) {
		return true;
	}
	if ((isManyRelation && countMany) || (!isManyRelation && countOne)) {
		return { count: true };
	}

	return true;
}

/**
 * Populate the model for Dynamic Zone components
 * @param {Object} attribute - Attribute containing the components
 * @param {String[]} attribute.components - IDs of components
 * @param {Object} options - Options to apply while populating
 * @param {Boolean} options.countMany
 * @param {Boolean} options.countOne
 * @param {Number} options.maxLevel
 * @param {Number} level
 * @returns {{populate: Object}}
 */
function getPopulateForDZ(attribute, options, level) {
	const populatedComponents = (attribute.components || []).map((componentUID) =>
		getDeepPopulate(componentUID, options, level + 1)
	);

	return { populate: populatedComponents.reduce(_.merge, {}) };
}

/**
 * Get the populated value based on the type of the attribute
 * @param {String} attributeName - Name of the attribute
 * @param {Object} model - Model of the populated entity
 * @param {Object} model.attributes
 * @param {Object} options - Options to apply while populating
 * @param {Boolean} options.countMany
 * @param {Boolean} options.countOne
 * @param {Number} options.maxLevel
 * @param {Number} level
 * @returns {Object}
 */
function getPopulateFor(attributeName, model, options, level) {
	const attribute = model.attributes[attributeName];

	switch (attribute.type) {
		case 'relation':
			return {
				[attributeName]: getPopulateForRelation(attribute, model, attributeName, options),
			};
		case 'component':
			return {
				[attributeName]: {
					populate: getDeepPopulate(attribute.component, options, level + 1),
				},
			};
		case 'media':
			return {
				[attributeName]: { populate: 'folder' },
			};
		case 'dynamiczone':
			return {
				[attributeName]: getPopulateForDZ(attribute, options, level),
			};
		default:
			return {};
	}
}

/**
 * Deeply populate a model based on UID
 * @param {String} uid - Unique identifier of the model
 * @param {Object} [options] - Options to apply while populating
 * @param {Boolean} [options.countMany=false]
 * @param {Boolean} [options.countOne=false]
 * @param {Number} [options.maxLevel=Infinity]
 * @param {Number} [level=1] - Current level of nested call
 * @returns {Object}
 */
const getDeepPopulate = (
	uid,
	{ countMany = false, countOne = false, maxLevel = Infinity } = {},
	level = 1
) => {
	if (level > maxLevel) {
		return {};
	}

	const model = strapi.getModel(uid);

	return Object.keys(model.attributes).reduce(
		(populateAcc, attributeName) =>
			_.merge(
				populateAcc,
				getPopulateFor(attributeName, model, { countMany, countOne, maxLevel }, level)
			),
		{}
	);
};

export default getDeepPopulate;
