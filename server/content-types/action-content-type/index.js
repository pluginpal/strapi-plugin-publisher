export default {
	kind: 'collectionType',
	collectionName: 'actions',
	info: {
		singularName: 'action',
		pluralName: 'actions',
		displayName: 'actions',
	},
	pluginOptions: {
		'content-manager': {
			visible: false,
		},
		'content-type-builder': {
			visible: false,
		},
	},
	options: {
		draftAndPublish: false,
		comment: '',
	},
	attributes: {
		executeAt: {
			type: 'datetime',
			required: true,
		},
		mode: {
			type: 'string',
			required: true,
		},
		entityId: {
			type: 'string',
			required: true,
		},
		entitySlug: {
			type: 'string',
			required: true,
		},
		timezone: {
			type: 'string',
			required: true,
	},
}
