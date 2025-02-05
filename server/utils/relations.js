import _ from 'lodash';

// constants
const ID_ATTRIBUTE = 'id';
const CREATED_AT_ATTRIBUTE = 'createdAt';
const UPDATED_AT_ATTRIBUTE = 'updatedAt';

export function isAnyToMany(attribute) {
	return (
		isRelationalAttribute(attribute) && ['oneToMany', 'manyToMany'].includes(attribute.relation)
	);
}

function isRelationalAttribute(attribute) {
	return attribute && attribute.type === 'relation';
}

export function isVisibleAttribute(model, attributeName) {
	return getVisibleAttributes(model).includes(attributeName);
}

function getVisibleAttributes(model) {
	return _.difference(_.keys(model.attributes), getNonVisibleAttributes(model));
}

function getNonVisibleAttributes(model) {
	const nonVisibleAttributes = _.reduce(
		model.attributes,
		(acc, attr, attrName) => (attr.visible === false ? acc.concat(attrName) : acc),
		[]
	);

	return _.uniq([ID_ATTRIBUTE, ...getTimestamps(model), ...nonVisibleAttributes]);
}

function getTimestamps(model) {
	const attributes = [];

	if (_.has(CREATED_AT_ATTRIBUTE, model.attributes)) {
		attributes.push(CREATED_AT_ATTRIBUTE);
	}

	if (_.has(UPDATED_AT_ATTRIBUTE, model.attributes)) {
		attributes.push(UPDATED_AT_ATTRIBUTE);
	}

	return attributes;
}