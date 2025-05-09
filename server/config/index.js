import pluginConfigSchema from './schema';

export default {
	default: () => ({
		enabled: true,
		defaultTimezone: 'UTC',
		actions: {
			syncFrequency: '*/1 * * * *',
		},
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
