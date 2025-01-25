import React, { useState, useEffect } from 'react';
import { useIntl } from 'react-intl';
import { Box, Flex, Typography, Divider, Loader } from '@strapi/design-system';
import Action from '../Action';
import { getTrad } from '../../utils/getTrad';
import { useSettings } from '../../hooks/useSettings';
import { unstable_useContentManagerContext as useContentManagerContext } from '@strapi/strapi/admin';
import { unstable_useDocument as useDocument } from '@strapi/strapi/admin';

const actionModes = ['publish', 'unpublish'];

const ActionManagerComponent = ({ document, entity }) => {
	const { formatMessage } = useIntl();
	const [showActions, setShowActions] = useState(false);
	const { getSettings } = useSettings();
	const { isLoading, data, isRefetching } = getSettings();

	useEffect(() => {
		if (!isLoading && !isRefetching) {
			if (!data.contentTypes?.length || data.contentTypes?.find((uid) => uid === document.model)) {
				setShowActions(true);
			}
		}
	}, [isLoading, isRefetching, data, document]);

	if (!showActions) {
		return null;
	}

	return (
		<Box marginTop={8}>
			<Typography variant="sigma" textColor="neutral600">
				{formatMessage({
					id: getTrad('plugin.name'),
					defaultMessage: 'Publisher',
				})}
			</Typography>
			<Box marginTop={2} marginBottom={4}>
				<Divider />
			</Box>
			<Flex marginTop={2} gap={{ initial: 2 }} direction={{ initial: 'column' }}>
				{actionModes.map((mode, index) => (
					<Action
						mode={mode}
						key={`${mode}-${index}`}
						documentId={document.documentId}
						entitySlug={entity.model}
					/>
				))}
			</Flex>
		</Box>
	);
};

const ActionManager = () => {
	const entity = useContentManagerContext();
	const { document, isLoading } = useDocument({
		documentId: entity?.id,
		model: entity?.model,
		collectionType: entity?.collectionType,
	});

	if (isLoading) {
		return (
			<Box marginTop={8}>
				<Loader>Loading document data...</Loader>
			</Box>
		);
	}

	if (!document) {
		console.warn('Document is null or undefined.');
		return null;
	}

	if (!entity) {
		console.warn('Entity is null or undefined.');
		return null;
	}

	if (!entity.hasDraftAndPublish) {
		console.warn('Entity does not have draft and publish enabled.');
		return null;
	}

	if (entity.isCreatingEntry) {
		console.warn('Entity is in creating mode.');
		return null;
	}

	console.log('Document:', document);
	console.log('Entity:', entity);

	return <ActionManagerComponent document={document} entity={entity} />;
};

export default ActionManager;
