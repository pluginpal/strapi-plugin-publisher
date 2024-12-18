'use strict';

import registerCronTasks from './config/cron-tasks';

export default ({ strapi }) => {
	registerCronTasks({ strapi });
}
