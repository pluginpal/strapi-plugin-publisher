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
		app.getPlugin('content-manager').injectComponent(
			'editView',
			'right-links',
			{ name: 'action-manager', Component: ActionManager }
		);
	},
	
	async registerTrads(app: any) {
		const { locales } = app;
		const importedTrads = [];

		for (const locale of locales) {
			try {
				const data = await import(`./translations/${locale}.json`);
				importedTrads.push({
					data: prefixPluginTranslations(data, pluginId),
					locale,
				});
			} catch (error) {
				importedTrads.push({ data: {}, locale });
			}
		}

		return importedTrads;
	},
};
