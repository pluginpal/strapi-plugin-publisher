import * as yup from 'yup';

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
	contentTypes: yup.array().of(yup.string()).optional(),
});

export default pluginConfigSchema;
