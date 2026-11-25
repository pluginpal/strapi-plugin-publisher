import { errors } from '@strapi/utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import canManageAction from '../../server/policies/can-manage-action';
import { ACTION_UID, ARTICLE_UID, createStrapi } from '../helpers/strapi';

describe('can-manage-action policy (#212)', () => {
	const userAbility = { can: vi.fn() };
	const storedAction = {
		documentId: 'action-1',
		mode: 'publish',
		entitySlug: ARTICLE_UID,
		entityId: 'article-1',
		locale: 'nl',
	};
	let permissionService;
	let actions;

	const policyContext = (method, { data, id = 'action-1' } = {}) => ({
		state: { userAbility },
		request: { method, body: data === undefined ? undefined : { data } },
		params: { id },
	});

	beforeEach(() => {
		permissionService = { assertCanSchedule: vi.fn().mockResolvedValue(undefined) };
		const { strapi } = createStrapi({ services: { permissionService } });
		actions = strapi.documents(ACTION_UID);
		actions.findOne.mockResolvedValue(storedAction);
	});

	describe('POST (schedule)', () => {
		it('requires publish permission on the target in the request body', async () => {
			const data = {
				mode: 'publish',
				entitySlug: ARTICLE_UID,
				entityId: 'article-1',
				locale: 'en',
			};

			await expect(canManageAction(policyContext('POST', { data }))).resolves.toBe(true);

			expect(permissionService.assertCanSchedule).toHaveBeenCalledOnce();
			expect(permissionService.assertCanSchedule).toHaveBeenCalledWith(userAbility, data);
			expect(actions.findOne).not.toHaveBeenCalled();
		});

		it('checks an empty target when there is no body', async () => {
			await canManageAction(policyContext('POST'));

			expect(permissionService.assertCanSchedule).toHaveBeenCalledWith(userAbility, {});
		});

		it('refuses users who may not publish the target', async () => {
			permissionService.assertCanSchedule.mockRejectedValue(new errors.PolicyError('Not allowed'));

			await expect(
				canManageAction(policyContext('POST', { data: { entitySlug: ARTICLE_UID } }))
			).rejects.toBeInstanceOf(errors.PolicyError);
		});
	});

	describe.each(['PUT', 'DELETE'])('%s of an unknown action', (method) => {
		it("leaves it to Strapi's controller", async () => {
			actions.findOne.mockResolvedValue(null);

			await expect(canManageAction(policyContext(method, { id: 'missing' }))).resolves.toBe(true);

			expect(actions.findOne).toHaveBeenCalledWith({ documentId: 'missing' });
			expect(permissionService.assertCanSchedule).not.toHaveBeenCalled();
		});
	});

	describe('DELETE', () => {
		it('requires publish permission on the target of the stored action, which may be deleted', async () => {
			await expect(canManageAction(policyContext('DELETE'))).resolves.toBe(true);

			expect(actions.findOne).toHaveBeenCalledWith({ documentId: 'action-1' });
			expect(permissionService.assertCanSchedule).toHaveBeenCalledOnce();
			expect(permissionService.assertCanSchedule).toHaveBeenCalledWith(userAbility, storedAction, {
				allowMissingEntity: true,
			});
		});
	});

	describe('PUT (reschedule)', () => {
		const checkedTargets = () =>
			permissionService.assertCanSchedule.mock.calls.map(([, checkedTarget]) => checkedTarget);

		it('checks the current target, and the same target when only the date changes', async () => {
			await expect(
				canManageAction(policyContext('PUT', { data: { executeAt: '2030-01-01T00:00:00.000Z' } }))
			).resolves.toBe(true);

			expect(checkedTargets()).toEqual([
				storedAction,
				{ entitySlug: ARTICLE_UID, entityId: 'article-1', locale: 'nl' },
			]);
		});

		it('also checks the new target when the action is moved to another entry or locale', async () => {
			await canManageAction(
				policyContext('PUT', { data: { entityId: 'article-2', locale: 'en' } })
			);

			expect(checkedTargets()[1]).toEqual({
				entitySlug: ARTICLE_UID,
				entityId: 'article-2',
				locale: 'en',
			});
		});

		it('checks the default locale when the update clears the locale', async () => {
			await canManageAction(policyContext('PUT', { data: { locale: null } }));

			expect(checkedTargets()[1]).toEqual({
				entitySlug: ARTICLE_UID,
				entityId: 'article-1',
				locale: null,
			});
		});

		it('refuses users who may not publish the current target', async () => {
			permissionService.assertCanSchedule.mockRejectedValueOnce(
				new errors.PolicyError('Not allowed')
			);

			await expect(
				canManageAction(policyContext('PUT', { data: { entityId: 'article-2' } }))
			).rejects.toBeInstanceOf(errors.PolicyError);
			expect(permissionService.assertCanSchedule).toHaveBeenCalledOnce();
		});

		it('refuses users who may not publish the new target', async () => {
			permissionService.assertCanSchedule
				.mockResolvedValueOnce(undefined)
				.mockRejectedValueOnce(new errors.PolicyError('Not allowed'));

			await expect(
				canManageAction(policyContext('PUT', { data: { entityId: 'article-2' } }))
			).rejects.toBeInstanceOf(errors.PolicyError);
		});
	});
});
