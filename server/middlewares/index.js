import limitToReadableContentTypes from './limit-to-readable-content-types';

/**
 * Route middlewares, referenced in routes as `plugin::publisher.<name>`.
 * validate-before-scheduling is a Document Service middleware and is registered in register.js.
 */
export default {
	'limit-to-readable-content-types': limitToReadableContentTypes,
};
