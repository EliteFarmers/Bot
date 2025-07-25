import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

import dotenv from 'dotenv';

dotenv.config();

if (process.env.SENTRY_DSN) {
	console.log('Sentry enabled');
	Sentry.init({
		dsn: process.env.SENTRY_DSN,
		integrations: [nodeProfilingIntegration()],
		// Tracing
		tracesSampleRate: 1.0, //  Capture 100% of the transactions

		// Set sampling rate for profiling - this is relative to tracesSampleRate
		profilesSampleRate: 1.0,
	});
}
