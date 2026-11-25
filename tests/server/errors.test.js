import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { errors } from '@strapi/utils';
import { describe, expect, it } from 'vitest';
import { NotFoundError, PolicyError, ValidationError } from '../../server/utils/errors';

const SERVER_DIR = join(import.meta.dirname, '../../server');

describe('request errors (server/utils/errors.js, #244)', () => {
	it.each([
		['ValidationError', ValidationError, errors.ValidationError, 400],
		['PolicyError', PolicyError, errors.PolicyError, 403],
		['NotFoundError', NotFoundError, errors.NotFoundError, 404],
	])("%s is Strapi's error with the HTTP status", (name, ErrorClass, StrapiError, status) => {
		const details = { errors: [{ path: ['title'], message: 'title is required' }] };

		const error = new ErrorClass('Something is wrong', details);

		// Strapi's error middleware uses the instanceof checks when the plugin shares its
		// @strapi/utils copy, and falls back to `status` (http-errors) when it doesn't.
		expect(error).toBeInstanceOf(StrapiError);
		expect(error).toBeInstanceOf(errors.ApplicationError);
		expect(error).toMatchObject({ name, message: 'Something is wrong', details, status });
	});

	it('is what the server code throws instead of the errors of @strapi/utils', () => {
		const files = readdirSync(SERVER_DIR, { recursive: true }).filter(
			(file) => file.endsWith('.js') && file !== join('utils', 'errors.js')
		);
		const offenders = files.filter((file) =>
			/new errors\.\w+/.test(readFileSync(join(SERVER_DIR, file), 'utf8'))
		);

		expect(offenders).toEqual([]);
	});
});
