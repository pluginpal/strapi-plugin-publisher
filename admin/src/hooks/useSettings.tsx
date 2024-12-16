import { useState, useEffect } from 'react';
import { useFetchClient } from '@strapi/strapi/admin';
import { pluginId } from '../pluginId';

export const useSettings = () => {
	const { get } = useFetchClient();
	const [settings, setSettings] = useState(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState(null);

	const fetchSettings = async () => {
		setIsLoading(true);
		setError(null);

		try {
			const response = await get(`/${pluginId}/settings`);
			setSettings(response.data?.data || null);
		} catch (err) {
			// @ts-ignore
			setError(err);
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		fetchSettings();
	}, []);

	return {
		settings,
		isLoading,
		error,
		refetch: fetchSettings,
	};
};
