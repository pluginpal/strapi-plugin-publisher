import { prefixPluginTranslations } from '@strapi/helper-plugin';
import pluginPkg from '../../package.json';
import { pluginId } from './pluginId';
import Initializer from './components/Initializer';
import ActionManager from './components/ActionManager';

const name = pluginPkg.strapi.name;

export default {
	register(app) {
		app.registerPlugin({
			id: pluginId,
			initializer: Initializer,
			isReady: false,
			name,
		});
	},

	bootstrap(app) {
		app.injectContentManagerComponent('editView', 'informations', {
			name: name,
			Component: ActionManager,
		});
	},

	async registerTrads({ locales }) {
		const importedTrads = await Promise.all(
			locales.map((locale) => {
				console.log(locale, 'locale');
				return import(`./translations/${locale}.json`)
					.then(({ default: data }) => {
						return {
							data: prefixPluginTranslations(data, 'users-permissions'),
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
