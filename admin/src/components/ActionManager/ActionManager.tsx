import React, { useState, useEffect } from 'react';
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

	useEffect(() => {
		if (! isLoading && ! isRefetching) {
			if (! data.contentTypes?.length || data.contentTypes?.find((uid) => uid === document.model)) {
				setShowActions(true);
			}
		}
	}, [isLoading, isRefetching, data, document]);

	if (! showActions) {
		return null;
	}

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

	console.log(document,'document');
	console.log(entity,'entity');

	if (! entity.hasDraftAndPublish || entity.isCreatingEntry) {
		return null;
	}

	if (! document || ! entity) {
		return null;
	}

	return <ActionManagerComponent document={document} entity={entity} />;
};

export default ActionManager;
