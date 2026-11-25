import { errors } from '@strapi/utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ARTICLE_UID, createPermissionChecker, createStrapi } from '../helpers/strapi';

const PAGE_UID = 'api::page.page';
const AUTHOR_UID = 'api::author.author';
const READ = 'plugin::content-manager.explorer.read';

const contentType = (uid, draftAndPublish) => ({
	uid,
	options: { draftAndPublish },
	attributes: {},
});

const contentTypes = {
	[ARTICLE_UID]: contentType(ARTICLE_UID, true),
	[PAGE_UID]: contentType(PAGE_UID, true),
	[AUTHOR_UID]: contentType(AUTHOR_UID, false),
	'plugin::publisher.action': contentType('plugin::publisher.action', false),
};

// What the permission checker returns for the user's publish permission, e.g. an "is creator"
// condition; the entry is populated from it.
const PERMISSION_QUERY = { filters: { createdBy: { id: 1 } } };

describe('permission service (#212)', () => {
	const userAbility = { can: vi.fn() };
	let strapi;
	let service;
	let permissionChecker;
	let populateBuilder;
	let articles;

	const setup = ({ canPublish } = {}) => {
		permissionChecker = createPermissionChecker({ canPublish, permissionQuery: PERMISSION_QUERY });
		let services;
		let contentManagerServices;
		({ strapi, services, contentManagerServices } = createStrapi({
			contentTypes,
			contentManagerServices: { 'permission-checker': permissionChecker },
		}));
		service = services.permissionService;
		populateBuilder = contentManagerServices['populate-builder'];
		articles = strapi.documents(ARTICLE_UID);
	};

	beforeEach(() => {
		userAbility.can.mockReset();
		setup();
	});

	describe('getReadableContentTypes', () => {
		it('lists the content types with draft & publish the user can read', () => {
			userAbility.can.mockImplementation(
				(action, uid) => action === READ && [ARTICLE_UID, AUTHOR_UID].includes(uid)
			);

			// Author can be read but has no draft & publish, so it can't have actions.
			expect(service.getReadableContentTypes(userAbility)).toEqual([ARTICLE_UID]);
		});

		it('is empty when the user cannot read any of them', () => {
			userAbility.can.mockReturnValue(false);

			expect(service.getReadableContentTypes(userAbility)).toEqual([]);
		});
	});

	describe('assertCanSchedule', () => {
		const target = (overrides = {}) => ({
			entitySlug: ARTICLE_UID,
			entityId: 'article-1',
			locale: 'nl',
			...overrides,
		});
		const entry = { documentId: 'article-1', locale: 'nl' };

		const expectError = async (promise, ErrorClass, status, message) => {
			const error = await promise.catch((e) => e);
			expect(error).toBeInstanceOf(ErrorClass);
			// The status keeps the response a 4xx when the app has several @strapi/utils copies (#244).
			expect(error.status).toBe(status);
			expect(error.message).toBe(message);
		};

		it.each([
			['a content type without draft & publish', AUTHOR_UID],
			['an unknown content type', 'api::unknown.unknown'],
			['no content type', undefined],
			['a value that is not a uid', [ARTICLE_UID]],
		])('refuses %s', async (_, entitySlug) => {
			await expectError(
				service.assertCanSchedule(userAbility, target({ entitySlug })),
				errors.ValidationError,
				400,
				`"${entitySlug}" is not a content type with draft & publish enabled.`
			);
			expect(permissionChecker.create).not.toHaveBeenCalled();
		});

		it('refuses users without publish permission, without loading the entry', async () => {
			setup({ canPublish: () => false });

			await expectError(
				service.assertCanSchedule(userAbility, target()),
				errors.PolicyError,
				403,
				'You are not allowed to publish or unpublish this content type.'
			);
			expect(permissionChecker.create).toHaveBeenCalledWith({ userAbility, model: ARTICLE_UID });
			expect(articles.findOne).not.toHaveBeenCalled();
		});

		it('checks the draft in the locale of the action, populated for the permission conditions', async () => {
			articles.findOne.mockResolvedValue(entry);

			await expect(service.assertCanSchedule(userAbility, target())).resolves.toBeUndefined();

			expect(populateBuilder).toHaveBeenCalledWith(ARTICLE_UID);
			expect(populateBuilder.builder.populateFromQuery).toHaveBeenCalledWith(PERMISSION_QUERY);
			expect(populateBuilder.builder.populateDeep).toHaveBeenCalledWith(Infinity);
			expect(articles.findOne).toHaveBeenCalledOnce();
			expect(articles.findOne).toHaveBeenCalledWith({
				documentId: 'article-1',
				populate: '*',
				locale: 'nl',
				status: 'draft',
			});
			expect(permissionChecker.checker.cannot.publish).toHaveBeenLastCalledWith(entry);
		});

		it('checks the published version when there is no draft', async () => {
			articles.findOne.mockImplementation(async ({ status }) =>
				status === 'published' ? entry : null
			);

			await expect(service.assertCanSchedule(userAbility, target())).resolves.toBeUndefined();

			expect(articles.findOne).toHaveBeenLastCalledWith(
				expect.objectContaining({ documentId: 'article-1', locale: 'nl', status: 'published' })
			);
			expect(permissionChecker.checker.cannot.publish).toHaveBeenLastCalledWith(entry);
		});

		it('checks the default locale when the action has no locale', async () => {
			articles.findOne.mockResolvedValue(entry);

			await service.assertCanSchedule(userAbility, target({ locale: null }));

			expect(articles.findOne.mock.calls[0][0]).not.toHaveProperty('locale');
		});

		it('refuses an entry the user may not publish, e.g. because of its locale', async () => {
			// Publish permission on the content type, but only for nl entries.
			setup({ canPublish: (entity) => !entity || entity.locale === 'nl' });
			articles.findOne.mockResolvedValue({ documentId: 'article-1', locale: 'en' });

			await expectError(
				service.assertCanSchedule(userAbility, target({ locale: 'en' })),
				errors.PolicyError,
				403,
				'You are not allowed to publish or unpublish this entry.'
			);
		});

		it('throws a NotFoundError when the entry does not exist', async () => {
			await expectError(
				service.assertCanSchedule(userAbility, target()),
				errors.NotFoundError,
				404,
				'Document "article-1" of type "api::article.article" was not found.'
			);
			expect(articles.findOne).toHaveBeenCalledTimes(2);
		});

		it('allows a missing entry with allowMissingEntity, so its actions can be deleted', async () => {
			await expect(
				service.assertCanSchedule(userAbility, target(), { allowMissingEntity: true })
			).resolves.toBeUndefined();
		});

		it('still requires publish permission on the content type with allowMissingEntity', async () => {
			setup({ canPublish: () => false });

			await expect(
				service.assertCanSchedule(userAbility, target(), { allowMissingEntity: true })
			).rejects.toBeInstanceOf(errors.PolicyError);
		});
	});
});
