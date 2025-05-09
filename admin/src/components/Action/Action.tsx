import React, { useEffect, useState } from 'react';
import {
	useRBAC,
} from '@strapi/strapi/admin';
import PropTypes from 'prop-types';
import ActionTimePicker from './ActionDateTimePicker';
import ActionButtons from './ActionButtons/ActionButtons';
import { usePublisher } from '../../hooks/usePublisher';
import { Flex, Select, Option } from '@strapi/design-system';
import { useSettings } from '../../hooks/useSettings';
import { useIntl } from 'react-intl';
import { getTrad } from '../../utils/getTrad';

const Action = ({ mode, documentId, entitySlug }) => {
	const { createAction, getAction, updateAction, deleteAction } = usePublisher();
	const { formatMessage } = useIntl();
	// 1) pull your default from the plugin config
  const {
    data: settings = {},
    isLoading: settingsLoading,
  } = useSettings().getSettings();
  const defaultTz = settings.defaultTimezone || 'UTC';
  // 2) state for per‑action timezone
  const [timezone, setTimezone] = useState(defaultTz);
  // full list of IANA zones
  const [zones, setZones] = useState<string[]>([]);
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
	// 3) bootstrap IANA list once
  useEffect(() => {
    if (typeof Intl.supportedValuesOf === 'function') {
      setZones(Intl.supportedValuesOf('timeZone'));
    } else {
      setZones([defaultTz]);
    }
  }, []);

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
				setTimezone(data.timezone || defaultTz);
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
		try {
			if (!actionId) {
				const { data: response } = await createAction({
					mode,
					entityId: documentId,
					entitySlug,
					executeAt,
					timezone,
				});
				if (response.data && response.data.id) {
					setActionId(response.data.documentId);
				}
			} else {
				await updateAction({ id: actionId, body: { executeAt, timezone } });
			}
			setIsCreating(false);
			setIsEditing(true);
			setIsLoading(false);
		} catch (error) {
			setIsLoading(false);
			console.error('Error saving action:', error);
		}
	};

	const handleOnDelete = async () => {
		setIsLoading(true);
		await deleteAction({ id: actionId });
		setActionId(0);
		setExecuteAt(null);
		setTimezone(defaultTz);
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
			<Select
        label={formatMessage({
          id: getTrad(`action.header.${mode}.timezone.label`),
          defaultMessage: 'Timezone',
        })}
        name="timezone"
        onChange={setTimezone}
        value={timezone}
        disabled={!isCreating}
      >
        {zones.map((tz) => (
          <Option key={tz} value={tz}>
            {tz}
          </Option>
        ))}
      </Select>
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
