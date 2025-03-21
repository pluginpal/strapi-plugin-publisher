import React, { useEffect, useState } from 'react';
import {
	useRBAC,
} from '@strapi/strapi/admin';
import PropTypes from 'prop-types';
import ActionTimePicker from './ActionDateTimePicker';
import ActionButtons from './ActionButtons/ActionButtons';
import { usePublisher } from '../../hooks/usePublisher';
import { Flex } from '@strapi/design-system';

const Action = ({ mode, documentId, entitySlug }) => {
	const { createAction, getAction, updateAction, deleteAction } = usePublisher();
	// State management
	const [actionId, setActionId] = useState(0);
	const [isEditing, setIsEditing] = useState(false);
	const [executeAt, setExecuteAt] = useState(null);
	const [isCreating, setIsCreating] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [canPublish, setCanPublish] = useState(true);

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
				setExecuteAt(data.executeAt);
				setIsEditing(true);
			} else {
				setActionId(0);
			}
		}
	}, [isLoadingAction, isRefetchingAction]);

	// Handlers
	function handleDateChange(date) {
		setExecuteAt(date);
		//setExecuteAt(date.toISOString());
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
		// Create of update actie
		if (!actionId) {
			const { data: response } = await createAction({
				mode,
				entityId: documentId,
				entitySlug,
				executeAt,
			});
			if (response.data && response.data.id) {
				setActionId(response.data.documentId);
			}
		} else {
			await updateAction({ id: actionId, body: { executeAt } });
		}

		setIsCreating(false);
		setIsEditing(true);
		setIsLoading(false);
	};

	const handleOnDelete = async () => {
		setIsLoading(true);
		await deleteAction({ id: actionId });
		setActionId(0);
		setExecuteAt(null);
		setIsCreating(false);
		setIsEditing(false);
		setIsLoading(false);
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
