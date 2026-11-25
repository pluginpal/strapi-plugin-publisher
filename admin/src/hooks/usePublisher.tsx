import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useFetchClient, useNotification, useForm, useAPIErrorHandler } from '@strapi/strapi/admin';
import { useIntl } from 'react-intl';
import { pluginId } from '../pluginId';
import { getTrad } from '../utils/getTrad';
import { getActionParams, getActionQueryKey } from '../utils/actionQuery';

export const usePublisher = () => {
	const { toggleNotification } = useNotification();
	const setErrors = useForm('PublishAction', (state) => state.setErrors);
	const { _unstableFormatValidationErrors: formatValidationErrors } = useAPIErrorHandler();
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
				error.response?.data?.error?.message ||
				error.message ||
				formatMessage({
					id: 'notification.error',
					defaultMessage: 'An unexpected error occurred',
				}),
		});

		if (error.response?.data?.error?.name === 'ValidationError') {
			setErrors(formatValidationErrors(error.response?.data?.error));
		}
	}

	function getAction(lookup) {
		return useQuery({
			queryKey: getActionQueryKey(lookup),
			queryFn: function () {
				return get(`/${pluginId}/actions`, { params: getActionParams(lookup) });
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
			// Without the locale, so the actions of all locales of this entry are refreshed.
			const queryKey = getActionQueryKey({
				entityId: data.entityId,
				entitySlug: data.entitySlug,
				mode: data.mode,
			});
			onSuccessHandler({
				queryKey,
				notification: {
					type: 'success',
					tradId: `action.notification.${data.mode}.create.success`,
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
			// Without the locale, so the actions of all locales of this entry are refreshed.
			const queryKey = getActionQueryKey({
				entityId: data.entityId,
				entitySlug: data.entitySlug,
				mode: data.mode,
			});
			onSuccessHandler({
				queryKey,
				notification: {
					type: 'success',
					tradId: `action.notification.${data.mode}.update.success`,
				},
			});
		},
		onError: onErrorHandler,
	});

	const { mutateAsync: deleteAction } = useMutation({
		mutationFn: function ({ id }) {
			return del(`/${pluginId}/actions/${id}`);
		},
		onSuccess: (_response, actionMode) => {
			const { mode } = actionMode;
			const queryKey = getActionQueryKey({});
			onSuccessHandler({
				queryKey,
				notification: {
					type: 'success',
					tradId: `action.notification.${mode}.delete.success`,
				},
			});
		},
		onError: onErrorHandler,
	});

	return { getAction, createAction, updateAction, deleteAction };
};
