'use strict';

const yup = require('yup');

const pluginConfigSchema = yup.object().shape({
	actions: yup
		.object()
		.shape({
			syncFrequency: yup.string().optional(),
		})
		.optional(),
	hooks: yup.object().optional(),
	components: yup
		.object({
			dateTimePicker: yup
				.object({
					step: yup.number().optional(),
					locale: yup.string().optional(),
				})
				.optional(),
		})
		.optional(),
});

module.exports = {
	pluginConfigSchema,
};
