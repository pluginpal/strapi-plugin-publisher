import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import type { PanelComponent } from '@strapi/content-manager/strapi-admin';
import {
	unstable_useDocument as useDocument,
	unstable_useContentManagerContext as useContentManagerContext,
} from '@strapi/strapi/admin';
import { useSettings } from '../../hooks/useSettings';
import Action from '../Action';

const actionModes: Array<'publish' | 'unpublish'> = ['publish', 'unpublish'];

const ActionManager: PanelComponent = () => {
	const entity = useContentManagerContext();
	const location = useLocation();
	const params = new URLSearchParams(location.search);
	const currentLocale = params.get('plugins[i18n][locale]');

	// Fetch the document (draft/published) with the selected locale
	const { document } = useDocument({
		documentId: entity?.id,
		model: entity?.model,
		collectionType: entity?.collectionType,
		params: { locale: currentLocale },
	});

	// Load plugin settings (whitelist of content types)
	const { getSettings } = useSettings();
	const { isLoading, data, isRefetching } = getSettings();

	// Local state to determine whether to show the panel based on settings
	const [show, setShow] = useState<boolean>(true);

	// When settings finish loading, update visibility based on whitelist
	useEffect(() => {
		if (!isLoading && !isRefetching) {
			const allowedList = data?.contentTypes || [];
			const isAllowed = allowedList.length === 0 || allowedList.includes(entity.slug);
			setShow(isAllowed);
		}
	}, [isLoading, isRefetching, data?.contentTypes, entity.slug]);

	// Only proceed for content types with Draft & Publish enabled,
	// and not while creating a new entry
	if (!entity.hasDraftAndPublish || entity.isCreatingEntry) {
		return null;
	}

	// Wait until document and entity are loaded
	if (!document || !entity) {
		return null;
	}

	// Only hide after settings have loaded and the type is not allowed
	if (!isLoading && !isRefetching && !show) {
		return null;
	}

	// Render the panel with both action buttons
	return {
		title: 'Publisher',
		content: (
			<>
				{actionModes.map((mode) => (
					<div key={mode} style={{ width: '100%'}}>
						<Action
							mode={mode}
							documentId={document.documentId}
							entitySlug={entity.model}
							locale={currentLocale}
						/>
					</div>
				))}
			</>
		),
	};
};

export default ActionManager;
