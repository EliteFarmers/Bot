import { RefreshUserEntitlements } from "#api/elite.js";
import { Entitlement, Events } from "discord.js";

const settings = {
	event: Events.EntitlementDelete,
	execute: execute
}

export default settings;

async function execute(entitlement: Entitlement) {
	if (entitlement.userId) {
		await RefreshUserEntitlements(entitlement.userId);
	}
}