'use strict';

const { registerCronTasks } = require('./config/cron-tasks');

module.exports = ({ strapi }) => {
	registerCronTasks({ strapi });
};
