import validateBeforeScheduling from './middlewares/validate-before-scheduling';

export default ({ strapi }) => {
  strapi.documents.use(validateBeforeScheduling);
};
