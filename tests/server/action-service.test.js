import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createStrapi, ACTION_UID } from '../helpers/strapi';

// Strapi's core service, which the action service extends. The real one needs a running Strapi;
// this one only records calls, so we can check the cron job handling around them.
const coreService = {
	create: vi.fn(),
	update: vi.fn(),
	delete: vi.fn(),
};

vi.mock('@strapi/strapi', () => ({
	factories: {
		createCoreService:
			(uid, extend) =>
			({ strapi }) =>
				Object.setPrototypeOf(extend({ strapi }), coreService),
	},
}));

const { default: actionService } = await import('../../server/services/action-service');

const inMinutes = (minutes) => new Date(Date.now() + minutes * 60 * 1000).toISOString();

describe('action service', () => {
	let strapi;
	let cronJobs;
	let publicationService;
	let service;

	beforeEach(() => {
		publicationService = { toggle: vi.fn().mockResolvedValue() };
		({ strapi, cronJobs } = createStrapi({ services: { publicationService } }));
		service = actionService({ strapi });
		coreService.create.mockReset();
		coreService.update.mockReset();
		coreService.delete.mockReset();
	});

	describe('create (scheduling a publish/unpublish action)', () => {
		it('saves the action and schedules a cron job at executeAt', async () => {
			const executeAt = inMinutes(10);
			const action = { documentId: 'action-1', mode: 'publish', executeAt };
			coreService.create.mockResolvedValue(action);
			const params = { data: { mode: 'publish', executeAt, entityId: 'article-1' } };

			await expect(service.create(params)).resolves.toBe(action);

			expect(coreService.create).toHaveBeenCalledWith(params);
			expect(cronJobs).toHaveProperty('publisherAction_action-1');
			expect(cronJobs['publisherAction_action-1'].options).toEqual(new Date(executeAt));
		});

		it('does not schedule a cron job for a time in the past', async () => {
			coreService.create.mockResolvedValue({ documentId: 'action-1', executeAt: inMinutes(-1) });

			await service.create({ data: {} });

			expect(strapi.cron.add).not.toHaveBeenCalled();
			expect(strapi.log.warn).toHaveBeenCalledWith(expect.stringContaining('in the past'));
		});
	});

	describe('update (rescheduling an action)', () => {
		it('replaces the cron job with one at the new time', async () => {
			coreService.create.mockResolvedValue({ documentId: 'action-1', executeAt: inMinutes(10) });
			await service.create({ data: {} });
			strapi.cron.add.mockClear();
			const newTime = inMinutes(30);
			coreService.update.mockResolvedValue({ documentId: 'action-1', executeAt: newTime });

			await service.update('action-1', { data: { executeAt: newTime } });

			expect(strapi.cron.remove).toHaveBeenCalledWith('publisherAction_action-1');
			expect(coreService.update).toHaveBeenCalledWith('action-1', { data: { executeAt: newTime } });
			expect(cronJobs['publisherAction_action-1'].options).toEqual(new Date(newTime));
			expect(strapi.cron.remove.mock.invocationCallOrder[0]).toBeLessThan(
				strapi.cron.add.mock.invocationCallOrder[0]
			);
		});
	});

	describe('delete (cancelling an action)', () => {
		it('removes the cron job and the action', async () => {
			coreService.create.mockResolvedValue({ documentId: 'action-1', executeAt: inMinutes(10) });
			await service.create({ data: {} });
			coreService.delete.mockResolvedValue({ documentId: 'action-1' });

			await service.delete('action-1');

			expect(cronJobs).not.toHaveProperty('publisherAction_action-1');
			expect(coreService.delete).toHaveBeenCalledWith('action-1');
		});

		it('still deletes the action when there is no cron job to remove', async () => {
			strapi.cron.remove.mockImplementation(() => {
				throw new Error('job not found');
			});

			await service.delete('action-1');

			expect(strapi.log.warn).toHaveBeenCalledWith(expect.stringContaining('job not found'));
			expect(coreService.delete).toHaveBeenCalledWith('action-1');
		});
	});

	describe('the scheduled cron job', () => {
		const scheduleAndGetTask = async (mode = 'publish') => {
			coreService.create.mockResolvedValue({
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
			strapi.documents(ACTION_UID).findOne.mockResolvedValue(current);

			await task();

			expect(strapi.documents(ACTION_UID).findOne).toHaveBeenCalledWith({ documentId: 'action-1' });
			expect(publicationService.toggle).toHaveBeenCalledWith(current, mode);
			expect(cronJobs).not.toHaveProperty('publisherAction_action-1');
		});

		it('uses the latest version of the action', async () => {
			const task = await scheduleAndGetTask('publish');
			strapi
				.documents(ACTION_UID)
				.findOne.mockResolvedValue({ documentId: 'action-1', mode: 'unpublish' });

			await task();

			expect(publicationService.toggle).toHaveBeenCalledWith(expect.anything(), 'unpublish');
		});

		it('skips an action that was deleted in the meantime', async () => {
			const task = await scheduleAndGetTask();
			strapi.documents(ACTION_UID).findOne.mockResolvedValue(null);

			await task();

			expect(publicationService.toggle).not.toHaveBeenCalled();
			expect(cronJobs).not.toHaveProperty('publisherAction_action-1');
		});

		it('logs errors and still removes itself', async () => {
			const task = await scheduleAndGetTask();
			strapi
				.documents(ACTION_UID)
				.findOne.mockResolvedValue({ documentId: 'action-1', mode: 'publish' });
			publicationService.toggle.mockRejectedValue(new Error('boom'));

			await expect(task()).resolves.toBeUndefined();

			expect(strapi.log.error).toHaveBeenCalledWith(expect.stringContaining('boom'));
			expect(cronJobs).not.toHaveProperty('publisherAction_action-1');
		});
	});
});
