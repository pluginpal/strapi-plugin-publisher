import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useIntl } from 'react-intl';
import { Box, Typography, Divider } from '@strapi/design-system';
import Action from '../Action';
import { getTrad } from '../../utils/getTrad';
import { useSettings } from '../../hooks/useSettings';
import {
	unstable_useDocument as useDocument,
	unstable_useContentManagerContext as useContentManagerContext,
} from '@strapi/strapi/admin';

const actionModes = ['publish', 'unpublish'];

const ActionManagerComponent = ({ document, entity }) => {
	const { formatMessage } = useIntl();
	const [showActions, setShowActions] = useState(false);
	const { getSettings } = useSettings();
	const { isLoading, data, isRefetching } = getSettings();

	const location = useLocation();
	const params = new URLSearchParams(location.search);
	const currentLocale = params.get('plugins[i18n][locale]');

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

	const localizedEntry = [document, ...(document.localizations || [])].find(
		(entry) => entry.locale === currentLocale
	);

	if (!localizedEntry) return null;

	return (
		<>
			<Box marginTop={2} marginBottom={4}>
				<Divider />
			</Box>
			<Typography variant="sigma" textColor="neutral600">
				{formatMessage({
					id: getTrad('plugin.name'),
					defaultMessage: 'Publisher',
				})}
			</Typography>
			<Box marginTop={2}>
				<Divider />
			</Box>
			{actionModes.map((mode, index) => (
				<div className="actionButton" key={index}>
					<Action
						mode={mode}
						key={mode + index}
						documentId={document.documentId}
						entitySlug={entity.model}
						locale={localizedEntry.locale}
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

const ActionManager = () => {
	const entity = useContentManagerContext();
	const { document } = useDocument({
		documentId: entity?.id,
		model: entity?.model,
		collectionType: entity?.collectionType,
	});

	if (! entity.hasDraftAndPublish || entity.isCreatingEntry) {
		return null;
	}

	if (! document || ! entity) {
		return null;
	}

	return <ActionManagerComponent document={document} entity={entity} />;
};

export default ActionManager;
