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

const Action = ({ mode, documentId, entitySlug }) => {
	const { createAction, getAction, updateAction, deleteAction } = usePublisher();
	const entity = useContentManagerContext();
	const { toggleNotification } = useNotification();
	// State management
	const [actionId, setActionId] = useState(0);
	const [isEditing, setIsEditing] = useState(false);
	const [executeAt, setExecuteAt] = useState(null);
	const [isCreating, setIsCreating] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [canPublish, setCanPublish] = useState(true);

	let schema;

	// Schema validation for `publish` mode
	if (mode === 'publish') {
		const currentContentTypeLayout = entity.contentType || {};
		schema = createYupSchema(
			currentContentTypeLayout,
			{ components: entity.components || {} },
			{ isCreatingEntry: entity.isCreatingEntry, isDraft: false, isFromComponent: false }
		);
	}

	// Fetch RBAC permissions
	const { isLoading: isLoadingPermissions, allowedActions } = useRBAC({
		publish: [{ action: 'plugin::content-manager.explorer.publish', subject: entitySlug }],
	});

	useEffect(() => {
		if (!isLoadingPermissions) {
			setCanPublish(allowedActions.canPublish);
		}
	}, [isLoadingPermissions]);

	const {
		isLoading: isLoadingAction,
		data,
			isRefetching: isRefetchingAction,
		} = getAction({
		mode,
		entityId: documentId,
		entitySlug,
	});

	// Update state based on fetched action data
	useEffect(() => {
		setIsLoading(true);
		if (!isLoadingAction && !isRefetchingAction) {
			setIsLoading(false);
			if (data) {
				setActionId(data.documentId);
				setExecuteAt(data.executeAt || data.publishedAt);
				setIsEditing(true);
			} else {
				setActionId(0);
			}
		}
	}, [isLoadingAction, isRefetchingAction, data]);

	// Handlers
	function handleDateChange(date) {
		setExecuteAt(date.toISOString());
	}

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
			// Validate data with schema if `publish` mode
			if (mode === 'publish' && schema) {
				await schema.validate(entity.initialData, { abortEarly: false });
			}

			// Create of update actie
			if (!actionId) {
				const { data: response } = await createAction({
					mode,
					entityId: documentId,
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
		setIsLoading(true);
		try {
			await deleteAction({ id: actionId });
			setActionId(0);
			setExecuteAt(null);
			setIsCreating(false);
			setIsEditing(false);
		} catch (error) {
			toggleNotification({
				type: 'danger',
				message: 'An error occurred while deleting the action.',
			});
			console.error(error);
		} finally {
			setIsLoading(false);
		}
	};

	// Render
	return (
		<Flex gap={{ initial: 2 }} direction={{ initial: 'column' }}>
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
	documentId: PropTypes.string.isRequired,
	entitySlug: PropTypes.string.isRequired,
};

export default Action;
