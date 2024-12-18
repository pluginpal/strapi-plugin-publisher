import pluginId from './pluginId';

/**
 * A helper function to obtain a plugin service
 *
 * @return service
 */
const getPluginService = (name) => strapi.plugin(pluginId).service(name);

export default getPluginService;
