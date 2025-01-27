import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useFetchClient, useNotification } from '@strapi/strapi/admin';
import { useIntl } from 'react-intl';
import { pluginId } from '../pluginId';
import { getTrad } from '../utils/getTrad';

const buildQueryKey = (args) => args.filter((a) => a);

export const usePublisher = () => {
	const { toggleNotification } = useNotification();
	const { del, post, put, get } = useFetchClient();
	const queryClient = useQueryClient();
	const { formatMessage } = useIntl();

	function onSuccessHandler({ queryKey, notification }) {
		queryClient.invalidateQueries(queryKey);
		toggleNotification({
			type: notification.type,
			message: formatMessage({
				id: getTrad(notification.tradId),
				defaultMessage: 'Action completed successfully',
			}),
		});
	}

	function onErrorHandler(error) {
		toggleNotification({
			type: 'danger',
			message:
				error.response?.error?.message ||
				error.message ||
				formatMessage({
					id: 'notification.error',
					defaultMessage: 'An unexpected error occurred',
				}),
		});
	}

	function getAction(filters = {}) {
		return useQuery({
			queryKey: buildQueryKey([
				pluginId,
				'entity-action',
				filters.documentId,
				filters.entitySlug,
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
				data.documentId,
				data.entitySlug,
				data.mode,
			]);
			onSuccessHandler({
				queryKey,
				notification: {
					type: 'success',
					tradId: `action.notification.${pluginId}.create.success`,
				},
			});
		},
		onError: onErrorHandler,
	});

	const { mutateAsync: updateAction } = useMutation({
		mutationFn: function ({ id, body }) {
			console.log('body', body, 'id', id);
			return put(`/${pluginId}/actions/${id}`, { data: body });
		},
		onSuccess: ({ data: response }) => {
			const { data } = response;
			const queryKey = buildQueryKey([
				pluginId,
				'entity-action',
				data.documentId,
				data.entitySlug,
				data.mode,
			]);
			console.log('data', data);
			console.log('response', response);
			onSuccessHandler({
				queryKey,
				notification: {
					type: 'success',
					tradId: `action.notification.${pluginId}.update.success`,
				},
			});
		},
		onError: onErrorHandler,
	});

	const { mutateAsync: deleteAction } = useMutation({
		mutationFn: function ({ id }) {
			return del(`/${pluginId}/actions/${id}`);
		},
		onSuccess: () => {
			const queryKey = buildQueryKey([
				pluginId,
				'entity-action',
			]);
			onSuccessHandler({
				queryKey,
				notification: {
					type: 'success',
					tradId: `action.notification.delete.success`,
				},
			});
		},
		onError: onErrorHandler,
	});

	return { getAction, createAction, updateAction, deleteAction };
};
