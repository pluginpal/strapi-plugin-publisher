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
				filters.entityId,
				filters.sentitySlug,
				filters.mode,
			]),
			queryFn: () => get(`/${pluginId}/actions`, { params: { filters } }),
			select: ({ data }) => data[0] || false,
		});
	}

	const { mutateAsync: createAction } = useMutation({
		mutationFn: (body) => post(`/${pluginId}/actions`, { data: body }),
		onSuccess: ({ data }) => {
			const queryKey = buildQueryKey([pluginId, 'entity-action', data.entityId]);
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
		mutationFn: ({ documentId, body }) =>
			put(`/${pluginId}/actions/${documentId}`, { data: body }),
		onSuccess: () => {
			const queryKey = buildQueryKey([pluginId, 'entity-action']);
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
		mutationFn: ({ documentId }) => del(`/${pluginId}/actions/${documentId}`),
		onSuccess: () => {
			const queryKey = buildQueryKey([pluginId, 'entity-action']);
			onSuccessHandler({
				queryKey,
				notification: {
					type: 'success',
					tradId: `action.notification.${pluginId}.delete.success`,
				},
			});
		},
		onError: onErrorHandler,
	});

	return { getAction, createAction, updateAction, deleteAction };
};
