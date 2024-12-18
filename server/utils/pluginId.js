import pluginPkg from '../../package.json';

/**
 * Returns the plugin id
 *
 * @return plugin id
 */
const pluginId = pluginPkg.strapi.name;

export default pluginId;
