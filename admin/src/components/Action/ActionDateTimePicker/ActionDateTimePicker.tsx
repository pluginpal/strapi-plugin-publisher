import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useIntl } from 'react-intl';
import { DateTimePicker, Typography } from '@strapi/design-system';
import { getTrad } from '../../../utils/getTrad';
import { useSettings } from '../../../hooks/useSettings';

import './ActionDateTimerPicker.css';

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
					// Validate the locale using Intl.DateTimeFormat
					new Intl.DateTimeFormat(customLocale);
					setLocale(customLocale); // Set the custom locale if valid
				} catch (error) {
					console.warn(
						`'${customLocale}' is not a valid locale format. Falling back to browser locale: '${browserLocale}'`,
					);
					setLocale(browserLocale);
				}
			}
		}
	}, [isLoading, isRefetching]);

	if (! isCreating && ! isEditing) {
		return null;
	}

	return (
		<>
			<div id="action-date-time-picker">
				<Typography variant="sigma" textColor="neutral600">
					{formatMessage({
						id: getTrad(`action.header.${mode}.title`),
						defaultMessage: `${mode} Date`,
					})}
				</Typography>

				<DateTimePicker
					aria-label="datetime picker"
					onChange={handleDateChange}
					value={executeAt ? new Date(executeAt) : null}
					disabled={! isCreating}
					step={step}
					locale={locale}
				/>
			</div>
			{/* TODO remove styling when this issue is fixed: https://github.com/strapi/design-system/issues/1853 */}
			<style>
				{`
					#action-date-time-picker {
							width: 100% !important;
					}
					#action-date-time-picker > div {
					    flex-direction: column !important;
					}
					#action-date-time-picker > div > div {
					    width: 100% !important;
					}
				`}
			</style>
		</>
	);
};

ActionDateTimePicker.propTypes = {
	executeAt: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
	onChange: PropTypes.func,
	mode: PropTypes.string.isRequired,
	isCreating: PropTypes.bool.isRequired,
	isEditing: PropTypes.bool.isRequired,
};

export default ActionDateTimePicker;
