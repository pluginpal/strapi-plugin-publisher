/**
 *  service
 */
import { createCoreService } from '@strapi/strapi';
// const { createCoreService } = require('@strapi/strapi').factories;

export default createCoreService('plugin::publisher.action');
