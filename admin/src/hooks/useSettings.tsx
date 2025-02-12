import { useQuery } from 'react-query';
import { useFetchClient } from '@strapi/strapi/admin';

import { pluginId } from '../pluginId';

export const useSettings = () => {
	const { get } = useFetchClient();

	function getSettings() {
		return useQuery({
			queryKey: [pluginId, 'settings'],
			queryFn: function () {
				return get(`/${pluginId}/settings`);
			},
			select: function ({ data }) {
				return data.data || false;
			},
		});
	}

	return {
		getSettings,
	};
};
