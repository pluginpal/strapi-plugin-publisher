import { useQuery, useMutation, useQueryClient } from 'react-query';

import { pluginId } from '../pluginId';
import { getTrad } from '../utils/getTrad';
import { useFetchClient, useNotification } from '@strapi/strapi/admin';

// @ts-ignore
const buildQueryKey = (args) => {
	// @ts-ignore
	return args.filter((a) => a);
};

export const usePublisher = () => {
	const { toggleNotification } = useNotification();
	const { del, post, put, get } = useFetchClient();
	const queryClient = useQueryClient();

	// @ts-ignore
	function onSuccessHandler({ queryKey, notification }) {
		queryClient.invalidateQueries(queryKey);
		toggleNotification({
			type: notification.type,
			// @ts-ignore
			message: { id: getTrad(notification.tradId) },
		});
	}
	// @ts-ignore
	function onErrorHandler(error) {
		toggleNotification({
			type: 'danger',
			message: error.response?.error?.message || error.message || { id: 'notification.error' },
		});
	}

	function getAction(filters = {}) {
		return useQuery({
			queryKey: buildQueryKey([
				pluginId,
				'entity-action',
				// @ts-ignore
				filters.entityId,
				// @ts-ignore
				filters.sentitySlug,
				// @ts-ignore
				filters.mode,
			]),
			queryFn: function () {
				return get(`/${pluginId}/actions`, {
					params: { filters },
				});
			},
			select: function ({ data }) {
				return data.data[0] || false;
			},
		});
	}

	const { mutateAsync: createAction } = useMutation({
		mutationFn: function (body) {
			return post(`/${pluginId}/actions`, { data: body });
		},
		onSuccess: ({ data: response }) => {
			const { data } = response;
			const queryKey = buildQueryKey([
				pluginId,
				'entity-action',
				data.attributes.entityId,
				data.attributes.entitySlug,
				data.attributes.mode,
			]);

			onSuccessHandler({
				queryKey,
				notification: {
					type: 'success',
					tradId: `action.notification.${data.attributes.mode}.create.success`,
				},
			});
		},
		onError: onErrorHandler,
	});

	const { mutateAsync: updateAction } = useMutation({
		// @ts-ignore
		mutationFn: function ({ id, body }) {
			return put(`/${pluginId}/actions/${id}`, { data: body });
		},
		onSuccess: ({ data: response }) => {
			const { data } = response;
			const queryKey = buildQueryKey([
				pluginId,
				'entity-action',
				data.attributes.entityId,
				data.attributes.entitySlug,
				data.attributes.mode,
			]);

			onSuccessHandler({
				queryKey,
				notification: {
					type: 'success',
					tradId: `action.notification.${data.attributes.mode}.update.success`,
				},
			});
		},
		onError: onErrorHandler,
	});

	const { mutateAsync: deleteAction } = useMutation({
		// @ts-ignore
		mutationFn: function ({ id }) {
			return del(`/${pluginId}/actions/${id}`);
		},
		onSuccess: ({ data: response }) => {
			const { data } = response;
			const queryKey = buildQueryKey([
				pluginId,
				'entity-action',
				data.attributes.entityId,
				data.attributes.entitySlug,
				data.attributes.mode,
			]);

			onSuccessHandler({
				queryKey,
				notification: {
					type: 'success',
					tradId: `action.notification.${data.attributes.mode}.delete.success`,
				},
			});
		},
		onError: onErrorHandler,
	});

	return { getAction, createAction, updateAction, deleteAction };
};
