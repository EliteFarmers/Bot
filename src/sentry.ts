import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

import dotenv from 'dotenv';

dotenv.config();

if (process.env.SENTRY_DSN) {
	console.log('Sentry enabled');
	Sentry.init({
		dsn: process.env.SENTRY_DSN,
		// Preserve the collection and transaction defaults from Sentry 10.
		traceLifecycle: 'static',
		dataCollection: {
			userInfo: false,
			cookies: false,
			httpHeaders: {
				request: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] },
				response: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] },
			},
			httpBodies: [],
			urlQueryParams: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] },
			genAI: { inputs: false, outputs: false },
			databaseQueryData: false,
			graphQL: { document: false, variables: false },
		},
		integrations: [nodeProfilingIntegration()],
		// Tracing
		tracesSampleRate: 1.0, //  Capture 100% of the transactions

		profileSessionSampleRate: 1.0,
		profileLifecycle: 'trace',
	});
}
