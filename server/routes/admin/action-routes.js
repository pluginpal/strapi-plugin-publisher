// Admin routes are open to every authenticated admin user, so access is limited to the user's
// Content Manager permissions for the content type an action targets (issue #212).
const canManageAction = { policies: ['plugin::publisher.can-manage-action'] };

export default [
	{
		method: 'GET',
		path: '/actions',
		handler: 'actionController.find',
		config: { middlewares: ['plugin::publisher.limit-to-readable-content-types'] },
	},
	{
		method: 'POST',
		path: '/actions',
		handler: 'actionController.create',
		config: canManageAction,
	},
	{
		method: 'DELETE',
		path: '/actions/:id',
		handler: 'actionController.delete',
		config: canManageAction,
	},
	{
		method: 'PUT',
		path: '/actions/:id',
		handler: 'actionController.update',
		config: canManageAction,
	},
];
