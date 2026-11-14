import getPluginService from '../utils/getPluginService';
import getPluginEntityUid from '../utils/getEntityUId';

const actionUid = getPluginEntityUid('action');

/**
 * Admin route policy: only lets a user create, update or delete a scheduled action when they are
 * allowed to publish its target in the Content Manager (issue #212). Admin routes are otherwise
 * open to every authenticated admin user; the content-api routes are guarded by the
 * Users & Permissions / API token permissions on the action content type instead.
 *
 * Throws a PolicyError (403 with a message) when the user isn't allowed.
 */
export default async (policyContext) => {
	const { userAbility } = policyContext.state;
	const permissionService = getPluginService('permissionService');
	const data = policyContext.request.body?.data || {};

	if (policyContext.request.method === 'POST') {
		await permissionService.assertCanSchedule(userAbility, data);
		return true;
	}

	// PUT and DELETE: check the existing action. Unknown ids have no target to check, so they are
	// left to the core controller (unchanged behaviour).
	const action = await strapi.documents(actionUid).findOne({ documentId: policyContext.params.id });
	if (!action) {
		return true;
	}

	if (policyContext.request.method === 'DELETE') {
		// Actions of entries that were deleted in the meantime can still be removed.
		await permissionService.assertCanSchedule(userAbility, action, { allowMissingEntity: true });
		return true;
	}

	// The user must be allowed to publish the current target as well as the updated one.
	await permissionService.assertCanSchedule(userAbility, action);
	await permissionService.assertCanSchedule(userAbility, {
		entitySlug: data.entitySlug ?? action.entitySlug,
		entityId: data.entityId ?? action.entityId,
		locale: data.locale ?? action.locale,
	});
	return true;
};
