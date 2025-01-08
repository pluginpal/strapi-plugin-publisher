'use strict';

import getPluginService from '../utils/getPluginService';

export default {
	/**
	 *  Fetch the current plugin settings
	 *
	 * @return {Array} actions
	 */
	async find(ctx) {
		ctx.send({ data: getPluginService('settingsService').get() });
	},
};
