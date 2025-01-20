import React, { useEffect, useState } from 'react';
import { useNotification, useRBAC } from '@strapi/strapi/admin';
import PropTypes from 'prop-types';
import { unstable_useContentManagerContext as useContentManagerContext } from '@strapi/strapi/admin';
import ActionTimePicker from './ActionDateTimePicker';
import ActionButtons from './ActionButtons/ActionButtons';
import { ValidationError } from 'yup';
import { usePublisher } from '../../hooks/usePublisher';
import { getTrad } from '../../utils/getTrad';
import { createYupSchema } from '../../utils/schema';
import { Flex } from '@strapi/design-system';

const Action = ({ mode, entityId, entitySlug }) => {
	const { createAction, getAction, updateAction, deleteAction } = usePublisher();
	const entity = useContentManagerContext();
	const { toggleNotification } = useNotification();
	const [actionId, setActionId] = useState(0);
	const [isEditing, setIsEditing] = useState(false);
	const [executeAt, setExecuteAt] = useState(0);
	const [isCreating, setIsCreating] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [canPublish, setCanPublish] = useState(true);

	let schema;
	console.log(entity, 'in Action.tsx');

	if (mode === 'publish') {
		const currentContentTypeLayout = entity.contentType || {};
		schema = createYupSchema(
			currentContentTypeLayout,
			{ components: entity.components || {} },
			{ isCreatingEntry: entity.isCreatingEntry, isDraft: false, isFromComponent: false }
		);
	}

	const { isLoading: isLoadingPermissions, allowedActions } = useRBAC({
		publish: [{ action: 'plugin::content-manager.explorer.publish', subject: entitySlug }],
	});

	useEffect(() => {
		if (!isLoadingPermissions) {
			console.log(allowedActions, 'allowedActions');
			setCanPublish(allowedActions.canPublish);
		}
	}, [isLoadingPermissions]);

	const {
		isLoading: isLoadingAction,
		data,
		isRefetching: isRefetchingAction,
	} = getAction({
		mode,
		entityId,
		entitySlug,
	});

	useEffect(() => {
		setIsLoading(true);
		if (!isLoadingAction && !isRefetchingAction) {
			setIsLoading(false);
			if (data) {
				setActionId(data.id);
				setExecuteAt(data.publishedAt);
				setIsEditing(true);
			} else {
				setActionId(0);
			}
		}
	}, [isLoadingAction, isRefetchingAction, data]);

	const handleDateChange = (date) => {
		console.log(date, 'date');
		setExecuteAt(date.toISOString());
	};

	const handleOnEdit = () => {
		setIsCreating(true);
		setIsEditing(false);
	};

	const handleOnCreate = () => {
		setIsCreating(true);
	};

	const handleOnSave = async () => {
		setIsLoading(true);
		try {
			if (mode === 'publish' && schema) {
				await schema.validate(entity.initialData, { abortEarly: false });
			}

			if (!actionId) {
				const { data: response } = await createAction({
					mode,
					entityId,
					entitySlug,
					executeAt,
				});

				if (response.data && response.data.id) {
					setActionId(response.data.id);
				}
			} else {
				await updateAction({ id: actionId, body: { executeAt } });
			}

			setIsCreating(false);
			setIsEditing(true);
		} catch (error) {
			if (error instanceof ValidationError) {
				toggleNotification({
					type: 'danger',
					message: getTrad('action.notification.publish.validation.error'),
				});
			}
			console.error(error);
		} finally {
			setIsLoading(false);
		}
	};

	const handleOnDelete = async () => {
		try {
			console.log(actionId, 'actionId');

			await deleteAction({ id: actionId });
			setActionId(0);
			setExecuteAt(0);
			setIsCreating(false);
			setIsEditing(false);
		} catch (error) {
			console.error(error);
		}
	};

	return (
		<Flex marginTop={2} gap={{initial: 2}} direction={{initial: 'column'}}>
			<ActionTimePicker
				onChange={handleDateChange}
				executeAt={executeAt}
				isCreating={isCreating}
				isEditing={isEditing}
				mode={mode}
			/>
			<ActionButtons
				mode={mode}
				onEdit={handleOnEdit}
				isEditing={isEditing}
				isCreating={isCreating}
				isLoading={isLoading}
				executeAt={executeAt}
				canPublish={canPublish}
				onCreate={handleOnCreate}
				onSave={handleOnSave}
				onDelete={handleOnDelete}
			/>
		</Flex>
	);
};

Action.propTypes = {
	mode: PropTypes.string.isRequired,
	entityId: PropTypes.number.isRequired,
	entitySlug: PropTypes.string.isRequired,
};

export default Action;
