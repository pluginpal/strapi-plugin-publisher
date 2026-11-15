import { beforeEach, describe, expect, it, vi } from 'vitest';
import actionService from '../../server/services/action-service';
import { createStrapi, ACTION_UID } from '../helpers/strapi';

const inMinutes = (minutes) => new Date(Date.now() + minutes * 60 * 1000).toISOString();

describe('action service', () => {
	let strapi;
	let cronJobs;
	let getCronJobs;
	let publicationService;
	let actions;
	let service;

	beforeEach(() => {
		publicationService = { toggle: vi.fn().mockResolvedValue() };
		({ strapi, cronJobs, getCronJobs } = createStrapi({ services: { publicationService } }));
		// The action service extends Strapi's real core service, which stores the actions with the
		// (fake) Document Service.
		actions = strapi.documents(ACTION_UID);
		service = actionService({ strapi });
	});

	describe('create (scheduling a publish/unpublish action)', () => {
		it('saves the action and schedules a cron job at executeAt', async () => {
			const executeAt = inMinutes(10);
			const action = { documentId: 'action-1', mode: 'publish', executeAt };
			actions.create.mockResolvedValue(action);
			const params = { data: { mode: 'publish', executeAt, entityId: 'article-1' } };

			await expect(service.create(params)).resolves.toBe(action);

			expect(actions.create).toHaveBeenCalledWith(expect.objectContaining(params));
			expect(getCronJobs('publisherAction_action-1')).toHaveLength(1);
			expect(cronJobs['publisherAction_action-1'].options).toEqual(new Date(executeAt));
		});

		it('does not schedule a cron job for a time in the past', async () => {
			actions.create.mockResolvedValue({ documentId: 'action-1', executeAt: inMinutes(-1) });

			await service.create({ data: {} });

			expect(strapi.cron.add).not.toHaveBeenCalled();
			expect(strapi.log.warn).toHaveBeenCalledWith(expect.stringContaining('in the past'));
		});
	});

	describe('update (rescheduling an action)', () => {
		it('replaces the cron job with one at the new time', async () => {
			actions.create.mockResolvedValue({ documentId: 'action-1', executeAt: inMinutes(10) });
			await service.create({ data: {} });
			strapi.cron.add.mockClear();
			const newTime = inMinutes(30);
			actions.update.mockResolvedValue({ documentId: 'action-1', executeAt: newTime });

			await service.update('action-1', { data: { executeAt: newTime } });

			expect(strapi.cron.remove).toHaveBeenCalledWith('publisherAction_action-1');
			expect(actions.update).toHaveBeenCalledWith(
				expect.objectContaining({ documentId: 'action-1', data: { executeAt: newTime } })
			);
			expect(getCronJobs('publisherAction_action-1')).toHaveLength(1);
			expect(cronJobs['publisherAction_action-1'].options).toEqual(new Date(newTime));
			expect(strapi.cron.remove.mock.invocationCallOrder[0]).toBeLessThan(
				strapi.cron.add.mock.invocationCallOrder[0]
			);
		});

		it('passes the query params on to the Document Service', async () => {
			actions.update.mockResolvedValue({ documentId: 'action-1', executeAt: inMinutes(30) });
			const params = { data: { executeAt: inMinutes(30) }, fields: ['executeAt'] };

			await service.update('action-1', params);

			expect(actions.update).toHaveBeenCalledWith(
				expect.objectContaining({ ...params, documentId: 'action-1' })
			);
		});
	});

	describe('delete (cancelling an action)', () => {
		it('removes the cron job and the action', async () => {
			actions.create.mockResolvedValue({ documentId: 'action-1', executeAt: inMinutes(10) });
			await service.create({ data: {} });
			actions.delete.mockResolvedValue({ documentId: 'action-1', entries: [{ id: 1 }] });

			await expect(service.delete('action-1', { fields: ['mode'] })).resolves.toEqual({
				deletedEntries: 1,
			});

			expect(getCronJobs('publisherAction_action-1')).toEqual([]);
			expect(cronJobs).not.toHaveProperty('publisherAction_action-1');
			expect(actions.delete).toHaveBeenCalledWith(
				expect.objectContaining({ documentId: 'action-1', fields: ['mode'] })
			);
		});

		it('deletes an action that has no cron job without a warning', async () => {
			actions.delete.mockResolvedValue({ documentId: 'action-1', entries: [{ id: 1 }] });

			await service.delete('action-1');

			expect(strapi.cron.remove).toHaveBeenCalledWith('publisherAction_action-1');
			expect(strapi.log.warn).not.toHaveBeenCalled();
			expect(actions.delete).toHaveBeenCalledWith(
				expect.objectContaining({ documentId: 'action-1' })
			);
		});
	});

	describe('the scheduled cron job', () => {
		const scheduleAndGetTask = async (mode = 'publish') => {
			actions.create.mockResolvedValue({
				documentId: 'action-1',
				mode,
				executeAt: inMinutes(10),
			});
			await service.create({ data: {} });
			return cronJobs['publisherAction_action-1'].task;
		};

		it.each(['publish', 'unpublish'])('executes the %s action and removes itself', async (mode) => {
			const task = await scheduleAndGetTask(mode);
			const current = { documentId: 'action-1', mode, entityId: 'article-1' };
			actions.findOne.mockResolvedValue(current);

			await task();

			expect(actions.findOne).toHaveBeenCalledWith({ documentId: 'action-1' });
			expect(publicationService.toggle).toHaveBeenCalledWith(current, mode);
			expect(getCronJobs('publisherAction_action-1')).toEqual([]);
		});

		it('uses the latest version of the action', async () => {
			const task = await scheduleAndGetTask('publish');
			actions.findOne.mockResolvedValue({ documentId: 'action-1', mode: 'unpublish' });

			await task();

			expect(publicationService.toggle).toHaveBeenCalledWith(expect.anything(), 'unpublish');
		});

		it('skips an action that was deleted in the meantime', async () => {
			const task = await scheduleAndGetTask();
			actions.findOne.mockResolvedValue(null);

			await task();

			expect(publicationService.toggle).not.toHaveBeenCalled();
			expect(cronJobs).not.toHaveProperty('publisherAction_action-1');
		});

		it('logs errors and still removes itself', async () => {
			const task = await scheduleAndGetTask();
			actions.findOne.mockResolvedValue({ documentId: 'action-1', mode: 'publish' });
			publicationService.toggle.mockRejectedValue(new Error('boom'));

			await expect(task()).resolves.toBeUndefined();

			expect(strapi.log.error).toHaveBeenCalledWith(expect.stringContaining('boom'));
			expect(cronJobs).not.toHaveProperty('publisherAction_action-1');
		});
	});
});
