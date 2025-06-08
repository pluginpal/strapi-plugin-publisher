import pluginPkg from '../../package.json';
import { pluginId } from './pluginId';
import Initializer from './components/Initializer';
import ActionManager from './components/ActionManager';
import { prefixPluginTranslations } from './utils/prefixPluginTranslation';

const name = pluginPkg.strapi.name;

export default {
	register(app: any) {
		app.registerPlugin({
			id: pluginId,
			initializer: Initializer,
			isReady: false,
			name,
		});
	},

	bootstrap(app: any) {
		app.getPlugin('content-manager').apis.addEditViewSidePanel([ActionManager]);
	},

	async registerTrads(app: any) {
		const { locales } = app;

		const importedTrads = await Promise.all(
			(locales as any[]).map((locale) => {
				return import(`./translations/${locale}.json`)
					.then(({ default: data }) => {
						return {
							data: prefixPluginTranslations(data, pluginId),
							locale,
						};
					})
					.catch(() => {
						return {
							data: {},
							locale,
						};
					});
			}),
		);

		return Promise.resolve(importedTrads);
	},
};
