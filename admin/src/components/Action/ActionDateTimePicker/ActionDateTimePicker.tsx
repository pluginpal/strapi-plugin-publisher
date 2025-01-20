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
	const { getSettings } = useSettings();

	function handleDateChange(date) {
		if (onChange) {
			onChange(date);
		}
	}

	const { isLoading, data, isRefetching } = getSettings();

	useEffect(() => {
		if (!isLoading && !isRefetching) {
			if (data) {
				setStep(data.components.dateTimePicker.step);

				const customLocale = data.components.dateTimePicker.locale;
				try {
					Intl.DateTimeFormat(customLocale);
					setLocale(customLocale);
				} catch (error) {
					console.log(
						`'${customLocale}' is not a valid format, using browser locale: '${browserLocale}'`
					);
				}
			}
		}
	}, [isLoading, isRefetching]);

	if (!isCreating && !isEditing) {
		return null;
	}

	return (
		<div id="action-date-time-picker">
			<Typography variant="sigma" textColor="neutral600" marginBottom={1}>
				{formatMessage({
					id: getTrad(`action.header.${mode}.title`),
					defaultMessage: `${mode} Date`,
				})}
			</Typography>

			<Flex>
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
