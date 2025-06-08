import pluginId from "./pluginId";

const logMessage = (msg = '') => `[strapi-plugin-${pluginId}]: ${msg}`;

export default logMessage;
