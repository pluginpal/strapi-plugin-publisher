import pluginConfigSchema from './schema';

export default {
		default: () => ({
			enabled: true,
			actions: {
				syncFrequency: '*/1 * * * *',
			},
			// Hooks allow you to run custom logic around publish/unpublish.
			// NOTE: If a before* hook explicitly returns false, the action will be cancelled.
			hooks: {
				beforePublish: () => {},
				afterPublish: () => {},
				beforeUnpublish: () => {},
				afterUnpublish: () => {},
			},
			components: {
				dateTimePicker: {
					step: 5,
				},
			},
		}),
		validator: async (config) => {
			await pluginConfigSchema.validate(config);
		},
	};
