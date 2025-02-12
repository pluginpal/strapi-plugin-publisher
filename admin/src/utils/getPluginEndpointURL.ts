import { pluginId } from '../pluginId';

/**
 * Auto prefix URLs with the plugin id
 *
 * @param {String} endpoint plugin specific endpoint
 * @returns {String} plugin id prefixed endpoint
 */
export const getPluginEndpointURL = (endpoint: any) => `/${pluginId}/${endpoint}`;
