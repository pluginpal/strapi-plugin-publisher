import React, { useState, useEffect } from 'react';
import { useIntl } from 'react-intl';
import { unstable_useContentManagerContext as useContentManagerContext } from '@strapi/strapi/admin';
import { Box, Flex, Typography, Divider } from '@strapi/design-system';
import Action from '../Action';
import { getTrad } from '../../utils/getTrad';
import { useSettings } from '../../hooks/useSettings';

const actionModes = ['publish', 'unpublish'];

const ActionManagerComponent = () => {
	const { formatMessage } = useIntl();
	const entity = useContentManagerContext();
	const [showActions, setShowActions] = useState(false);
	const { getSettings } = useSettings();
	const { isLoading, data, isRefetching } = getSettings();

	console.log(data, 'data');
	console.log(entity, 'entity');

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
			<Flex marginTop={2} gap={{initial: 2}} direction={{initial: 'column'}}>
				{actionModes.map((mode, index) => (
					<Action
						mode={mode}
						key={mode + index}
						entityId={entity.id}
						entitySlug={entity.slug}
					/>
				))}
			</Flex>
		</Box>
	);
};

const ActionManager = () => {
	const entity = useContentManagerContext();
	console.log(entity, 'entity');

	if (!entity.hasDraftAndPublish || entity.isCreatingEntry) {
		return null;
	}

	//if (!entity?.id) {
	//	return null;
	//}

	return <ActionManagerComponent />;
};

export default ActionManager;
