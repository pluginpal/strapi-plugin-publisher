'use strict';

import actionRoutes from './action-routes';
import settingsRoutes from './settings-routes';

export default {
	type: 'admin',
	routes: [...actionRoutes, ...settingsRoutes],
}
