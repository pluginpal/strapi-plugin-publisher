export default [
	{
		method: 'GET',
		path: '/actions',
		handler: 'actionController.find',
	},
	{
		method: 'POST',
		path: '/actions',
		handler: 'actionController.create',
	},
	{
		method: 'DELETE',
		path: '/actions/:id',
		handler: 'actionController.delete',
	},
	{
		method: 'PUT',
		path: '/actions/:id',
		handler: 'actionController.update',
	},
];
