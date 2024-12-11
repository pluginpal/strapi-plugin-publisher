import React, { useState, useEffect } from 'react';
import { useIntl } from 'react-intl';
import { unstable_useContentManagerContext as useContentManagerContext } from '@strapi/strapi/admin/hooks';
import { Box, Flex, Typography, Divider } from '@strapi/design-system';
import Action from '../Action';
import { getTrad } from '../../utils/getTrad';
import { useSettings } from '../../hooks/useSettings';

const actionModes = ['publish', 'unpublish'];

const ActionManagerComponent = () => {
	const { formatMessage } = useIntl();
	const {
		slug,
		isCreatingEntry,
		hasDraftAndPublish,
		form: { values: modifiedData },
	} = useContentManagerContext();

	const [showActions, setShowActions] = useState(false);
	const { settings, isLoading } = useSettings();

	useEffect(() => {
		if (!isLoading && settings) {
			if (
				!settings.contentTypes?.length ||
				settings.contentTypes?.includes(slug)
			) {
				setShowActions(true);
			}
		}
	}, [isLoading, settings, slug]);

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
			<Flex spacing={4} marginTop={2}>
				{actionModes.map((mode, index) => (
					<Action
						mode={mode}
						key={`${mode}-${index}`}
						entityId={modifiedData.id}
						entitySlug={slug}
					/>
				))}
			</Flex>
		</Box>
	);
};

const ActionManager = () => {
	const {
		isCreatingEntry,
		hasDraftAndPublish,
		form: { values: modifiedData },
	} = useContentManagerContext();

	if (!hasDraftAndPublish || isCreatingEntry || !modifiedData?.id) {
		return null;
	}

	return <ActionManagerComponent />;
};

export default ActionManager;
