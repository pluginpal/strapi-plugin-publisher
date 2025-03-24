import pluginId from '../utils/pluginId';

export default ({ strapi }) => ({
	get() {
		return strapi.config.get(`plugin::${pluginId}`);
	}
});
