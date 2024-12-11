import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useIntl } from 'react-intl';
import { DateTimePicker, Typography, Flex } from '@strapi/design-system';
import { getTrad } from '../../../utils/getTrad';
import { useSettings } from '../../../hooks/useSettings';

import './ActionDateTimerPicker.css';

//@ts-ignore
const ActionDateTimePicker = ({ executeAt, mode, isCreating, isEditing, onChange }) => {
	const { formatMessage, locale: browserLocale } = useIntl();
	const [locale, setLocale] = useState(browserLocale);
	const [step, setStep] = useState(1);
	const { settings, isLoading, error, refetch } = useSettings();

	function handleDateChange(date) {
		if (onChange) {
			onChange(date);
		}
	}

	useEffect(() => {
		if (!isLoading && settings) {
			setStep(settings.components.dateTimePicker.step);

			const customLocale = settings.components.dateTimePicker.locale;
			try {
				Intl.DateTimeFormat(customLocale);
				setLocale(customLocale);
			} catch (error) {
				console.log(
					`'${customLocale}' is not a valid format, using browser locale: '${browserLocale}'`
				);
			}
		}
	}, [isLoading, settings]);

	if (!isCreating && !isEditing) {
		return null;
	}

	return (
		<div id="action-date-time-picker">
			<Flex>
				<Typography variant="sigma" textColor="neutral600" marginBottom={1}>
					{formatMessage({
						id: getTrad(`action.header.${mode}.title`),
						defaultMessage: `${mode} Date`,
					})}
				</Typography>
				<DateTimePicker
					aria-label="datetime picker"
					onChange={handleDateChange}
					value={executeAt ? new Date(executeAt) : null}
					disabled={!isCreating}
					step={step}
					locale={locale}
				/>
			</Flex>
		</div>
	);
};

ActionDateTimePicker.propTypes = {
	executeAt: PropTypes.string,
	onChange: PropTypes.func,
	mode: PropTypes.string.isRequired,
	isCreating: PropTypes.bool.isRequired,
	isEditing: PropTypes.bool.isRequired,
};

export default ActionDateTimePicker;
