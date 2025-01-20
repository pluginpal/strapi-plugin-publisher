import React from 'react';
import { useIntl } from 'react-intl';
import PropTypes from 'prop-types';
import { Button, Flex } from '@strapi/design-system';
import { Check, Cross, PaperPlane, Pencil, Trash } from '@strapi/icons';
import { getTrad } from '../../../utils/getTrad';

const ActionButtons = ({
	mode,
	isEditing,
	onEdit,
	onCreate,
	isCreating,
	executeAt,
	onDelete,
	onSave,
	canPublish,
	isLoading,
}) => {
	const { formatMessage } = useIntl();

	function handleEditChange() {
		if (onEdit) {
			onEdit();
		}
	}

	function handleCreateChange() {
		if (onCreate) {
			onCreate();
		}
	}

	function handleSaveChange() {
		if (onSave) {
			onSave();
		}
	}

	function handleDeleteChange() {
		if (onDelete) {
			onDelete();
		}
	}

	// do not show any mutate buttons if user cannot publish
	if ((isCreating || isEditing) && !canPublish) {
		return null;
	}

	if (isCreating) {
		return (
			<Button
				disabled={isLoading || !executeAt}
				fullWidth
				variant="success-light"
				startIcon={<PaperPlane />}
				onClick={handleSaveChange}
			>
				{formatMessage({
					id: getTrad(`action.footer.${mode}.button.save`),
					defaultMessage: `Save`,
				})}
			</Button>
		);
	}

	if (isEditing) {
		return (
			<Flex marginTop={2} gap={{initial: 2}} direction={{initial: 'row'}}>
				<Button fullWidth onClick={handleEditChange} variant="tertiary" startIcon={<Pencil />}>
					{formatMessage({
						id: getTrad(`action.footer.${mode}.button.edit`),
						defaultMessage: `Edit`,
					})}
				</Button>
				<Button fullWidth variant="danger-light" startIcon={<Trash />} onClick={handleDeleteChange}>
					{formatMessage({
						id: getTrad(`action.footer.${mode}.button.delete`),
						defaultMessage: `Delete`,
					})}
				</Button>
			</Flex>
		);
	}

	return (
		<Button
			fullWidth
			variant={mode === 'publish' ? 'default' : 'secondary'}
			startIcon={mode === 'publish' ? <Check /> : <Cross />}
			onClick={handleCreateChange}
			disabled={!canPublish || isLoading}
		>
			{formatMessage({
				id: getTrad(`action.footer.${mode}.button.add`),
				defaultMessage: `${mode} date`,
			})}
		</Button>
	);
};

ActionButtons.propTypes = {
	mode: PropTypes.string.isRequired,
	executeAt: PropTypes.string,
	isEditing: PropTypes.bool.isRequired,
	onEdit: PropTypes.func,
	onCreate: PropTypes.func,
	isCreating: PropTypes.bool.isRequired,
	isLoading: PropTypes.bool.isRequired,
	onDelete: PropTypes.func,
	onSave: PropTypes.func,
	canPublish: PropTypes.bool.isRequired,
};

export default ActionButtons;
