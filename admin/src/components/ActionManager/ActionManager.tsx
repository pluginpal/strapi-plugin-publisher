import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useIntl } from 'react-intl';
import type { PanelComponent } from '@strapi/content-manager/strapi-admin';
import { Box, Typography, Divider } from '@strapi/design-system';
import Action from '../Action';
import { getTrad } from '../../utils/getTrad';
import { useSettings } from '../../hooks/useSettings';
import {
	unstable_useDocument as useDocument,
	unstable_useContentManagerContext as useContentManagerContext,
} from '@strapi/strapi/admin';
import { Modules } from '@strapi/strapi';

const actionModes = ['publish', 'unpublish'];

type Props = {
	document: Modules.Documents.AnyDocument,
	entity: ReturnType<typeof useContentManagerContext>,
	locale: string | null,
}

const ActionManagerComponent = ({ document, entity, locale }: Props) => {
	const { formatMessage } = useIntl();
	const [showActions, setShowActions] = useState(false);
	const { getSettings } = useSettings();
	const { isLoading, data, isRefetching } = getSettings();

	useEffect(() => {
		if (!isLoading && !isRefetching) {
			if (!data.contentTypes?.length || data.contentTypes?.find((uid) => uid === entity.slug)) {
				setShowActions(true);
			}
		}
	}, [isLoading, isRefetching]);

	if (!showActions) {
		return null;
	}

	return (
		<>
			{actionModes.map((mode, index) => (
				<div className="actionButton" key={index}>
					<Action
						mode={mode}
						key={mode + index}
						documentId={document.documentId}
						entitySlug={entity.model}
						locale={locale}
					/>
				</div>
			))}
			<style>
				{`
					.actionButton {
					    width: 100%;
					}
				`}
			</style>
		</>
	);
};

const ActionManager: PanelComponent = () => {
	const entity = useContentManagerContext();
	const location = useLocation();
	const params = new URLSearchParams(location.search);
	const currentLocale = params.get('plugins[i18n][locale]');

	const { document } = useDocument({
		documentId: entity?.id,
		model: entity?.model,
		collectionType: entity?.collectionType,
		params: {
			locale: currentLocale,
		}
	});

	if (! entity.hasDraftAndPublish || entity.isCreatingEntry) {
		return null;
	}

	if (! document || ! entity) {
		return null;
	}

	return {
		title: "Publisher",
		content: <ActionManagerComponent document={document} entity={entity} locale={currentLocale} />,
	}
};

export default ActionManager;
