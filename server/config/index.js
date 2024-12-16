'use strict';

const { pluginConfigSchema } = require('./schema');

module.exports = {
	default: () => ({
		enabled: true,
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
				step: 1,
			},
		},
	}),
	validator: async (config) => {
		await pluginConfigSchema.validate(config);
	},
};
