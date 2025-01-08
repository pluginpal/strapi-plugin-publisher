import React, { useEffect, useState } from 'react';
import { unstable_useContentManagerContext as useContentManagerContext } from '@strapi/strapi/admin';
import { useRBAC, useNotification } from '@strapi/strapi/admin';
import PropTypes from 'prop-types';
import { usePublisher } from '../../hooks/usePublisher';
import { Flex } from '@strapi/design-system';
import ActionTimePicker from './ActionDateTimePicker';
import ActionButtons from './ActionButtons/ActionButtons';
import { ValidationError } from 'yup';
import { createYupSchema } from '../../utils/schema';

const Action = ({ mode, entityId, entitySlug }) => {
	const { createAction, getAction, updateAction, deleteAction } = usePublisher();
	const { form: { initialValues, values: modifiedData } } = useContentManagerContext();
	const { toggleNotification } = useNotification();
	const [actionId, setActionId] = useState(0);
	const [isEditing, setIsEditing] = useState(false);
	const [executeAt, setExecuteAt] = useState(0);
	const [isCreating, setIsCreating] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [canPublish, setCanPublish] = useState(true);

	let schema;
	if (mode === 'publish') {
		const currentContentTypeLayout = modifiedData.layout || {};
		schema = createYupSchema(
			currentContentTypeLayout,
			{ components: modifiedData.components || {} },
			{ isCreatingEntry: modifiedData.isCreatingEntry, isDraft: false, isFromComponent: false },
		);
	}

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
		entityId,
		entitySlug,
	});

	// set initial data to state so it's reactive
	useEffect(() => {
		setIsLoading(true);
		if (!isLoadingAction && !isRefetchingAction) {
			setIsLoading(false);
			if (data) {
				setActionId(data.id);
				setExecuteAt(data.attributes.executeAt);
				setIsEditing(true);
			} else {
				setActionId(0);
			}
		}
	}, [isLoadingAction, isRefetchingAction]);

	// handlers
	function handleDateChange(date) {
		setExecuteAt(date);
	}

	function handleOnEdit() {
		setIsCreating(true);
		setIsEditing(false);
	}

	function handleOnCreate() {
		setIsCreating(true);
	}

	async function handleOnSave() {
		setIsLoading(true);
		try {
			if (mode === 'publish' && schema) {
				await schema.validate(modifiedData, { abortEarly: false });
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

			toggleNotification({
				type: 'success',
				message: 'Action saved successfully!',
			});
		} catch (error) {
			if (error instanceof ValidationError) {
				toggleNotification({
					type: 'danger',
					message: 'Required fields must be saved before a publish date can be set.',
				});
			} else {
				console.error(error);
			}
		} finally {
			setIsLoading(false);
		}
	}

	async function handleOnDelete() {
		try {
			await deleteAction({ id: actionId });
			setActionId(0);
			setExecuteAt(0);
			setIsCreating(false);
			setIsEditing(false);

			toggleNotification({
				type: 'success',
				message: 'Action deleted successfully!',
			});
		} catch (error) {
			console.error(error);
		}
	}

	return (
		<Flex>
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
