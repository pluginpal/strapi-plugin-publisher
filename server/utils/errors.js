import { errors } from '@strapi/utils';

/**
 * Strapi's errors, with the HTTP status the response should get as a `status` property.
 *
 * Strapi's error middleware picks the status with `instanceof` checks against its own copy of
 * @strapi/utils. An app can have several copies: e.g. with Strapi 5.61 npm installs a newer
 * @strapi/admin for the `^5.0.0` peer range of @strapi/plugin-users-permissions, which hoists a
 * newer @strapi/utils to the app root, while every Strapi package keeps its exact-pinned copy
 * nested. The plugin then loads the root copy, its errors fail those checks, and without a
 * `status` they become 500s. With it, Strapi's fallback (http-errors) still responds with this
 * status, the error name, message and details.
 */
const withStatus = (ErrorClass, status) =>
	class extends ErrorClass {
		constructor(...args) {
			super(...args);
			this.status = status;
		}
	};

export const ValidationError = withStatus(errors.ValidationError, 400);
export const PolicyError = withStatus(errors.PolicyError, 403);
export const NotFoundError = withStatus(errors.NotFoundError, 404);
