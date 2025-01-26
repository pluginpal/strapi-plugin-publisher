import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useFetchClient, useNotification } from '@strapi/strapi/admin';
import { useIntl } from 'react-intl';
import { pluginId } from '../pluginId';
import { getTrad } from '../utils/getTrad';

const buildQueryKey = (args) => args.filter((a) => a);
console.log('buildQueryKey', buildQueryKey);

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
			console.log(buildQueryKey, 'buildQueryKey in update action');
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
		mutationFn: function ({ id }) {
			return del(`/${pluginId}/actions/${id}`);
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
					tradId: `action.notification.${data.attributes.mode}.delete.success`,
				},
			});
		},
		onError: onErrorHandler,
	});

	return { getAction, createAction, updateAction, deleteAction };
};
