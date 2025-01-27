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
		},
		mode: {
			type: 'string',
		},
		entityId: {
			type: 'string',
		},
		entitySlug: {
			type: 'string',
		},
	},
}
