import { Entitlement, Events } from 'discord.js';
import { RefreshUserEntitlements } from '../api/elite';

const settings = {
	event: Events.EntitlementDelete,
	execute: execute,
};

export default settings;

async function execute(entitlement: Entitlement) {
	if (entitlement.userId) {
		await RefreshUserEntitlements(entitlement.userId);
	}
}
