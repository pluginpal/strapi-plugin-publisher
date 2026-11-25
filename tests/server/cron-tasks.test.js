import { beforeEach, describe, expect, it, vi } from 'vitest';
import registerCronTasks from '../../server/config/cron-tasks';
import { createStrapi } from '../helpers/strapi';

const inMinutes = (minutes) => new Date(Date.now() + minutes * 60 * 1000).toISOString();

describe('scheduling existing actions on startup', () => {
	let strapi;
	let actionService;
	let publicationService;

	beforeEach(() => {
		actionService = { find: vi.fn(), scheduleCronJob: vi.fn() };
		publicationService = { toggle: vi.fn().mockResolvedValue() };
		({ strapi } = createStrapi({ services: { action: actionService, publicationService } }));
	});

	const startup = async () => {
		registerCronTasks({ strapi });
		// The actions are loaded in a setImmediate, once all services are ready.
		await vi.waitFor(() =>
			expect(
				strapi.log.info.mock.calls.length + strapi.log.error.mock.calls.length
			).toBeGreaterThan(0)
		);
		await new Promise((resolve) => setImmediate(resolve));
	};

	it('executes overdue actions right away and schedules future ones', async () => {
		const overduePublish = { documentId: 'a1', mode: 'publish', executeAt: inMinutes(-60) };
		const overdueUnpublish = { documentId: 'a2', mode: 'unpublish', executeAt: inMinutes(-1) };
		const future = { documentId: 'a3', mode: 'publish', executeAt: inMinutes(60) };
		actionService.find.mockResolvedValue({ results: [overduePublish, future, overdueUnpublish] });

		await startup();

		expect(publicationService.toggle).toHaveBeenCalledTimes(2);
		expect(publicationService.toggle).toHaveBeenCalledWith(overduePublish, 'publish');
		expect(publicationService.toggle).toHaveBeenCalledWith(overdueUnpublish, 'unpublish');
		expect(actionService.scheduleCronJob).toHaveBeenCalledTimes(1);
		expect(actionService.scheduleCronJob).toHaveBeenCalledWith(future);
	});

	it('continues with the other actions when one fails', async () => {
		const failing = { documentId: 'a1', mode: 'publish', executeAt: inMinutes(-2) };
		const next = { documentId: 'a2', mode: 'publish', executeAt: inMinutes(-1) };
		actionService.find.mockResolvedValue({ results: [failing, next] });
		publicationService.toggle.mockRejectedValueOnce(new Error('boom'));

		await startup();

		expect(strapi.log.error).toHaveBeenCalledWith(expect.stringContaining('a1: boom'));
		expect(publicationService.toggle).toHaveBeenCalledWith(next, 'publish');
	});

	it('logs an error when the actions cannot be loaded', async () => {
		actionService.find.mockRejectedValue(new Error('no such table: actions'));

		await startup();

		expect(strapi.log.error).toHaveBeenCalledWith(
			expect.stringContaining('no such table: actions')
		);
		expect(publicationService.toggle).not.toHaveBeenCalled();
	});
});
