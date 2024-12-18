import pluginId from './pluginId';

const getPluginEntityUid = (entity) => `plugin::${pluginId}.${entity}`;

export default getPluginEntityUid;
