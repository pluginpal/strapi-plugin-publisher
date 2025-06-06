import { useFetchClient } from '@strapi/strapi/admin';
import { getPluginEndpointURL } from './getPluginEndpointURL';

// @ts-ignore
export const requestPluginEndpoint = async (endpoint: any, options = {}) => {
	const { get, post, put, del } = useFetchClient();
	const url = getPluginEndpointURL(endpoint);

// @ts-ignore
	switch (options.method?.toUpperCase()) {
		case 'POST':
			return post(url, options);
		case 'PUT':
			return put(url, options);
		case 'DELETE':
			return del(url, options);
		case 'GET':
		default:
			return get(url, options);
	}
};
