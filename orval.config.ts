import 'dotenv/config';
import { defineConfig } from 'orval';

export default defineConfig({
	elite: {
		input: {
			target: process.env.ELITE_API_URL + '/openapi/admin-v1.json',
		},
		output: {
			baseUrl: '${ELITE_API_URL}',
			client: 'fetch',
			target: './src/api/client',
			schemas: './src/api/schemas',
			namingConvention: 'PascalCase',
			override: {
				// useBigInt: true,
				// transformer: './src/api/util/fetch-transformer.ts',
				mutator: {
					path: './src/api/util/custom-fetch-placeholder.ts',
					name: 'customFetch',
				},
			},
		},
		hooks: {
			afterAllFilesWrite: {
				command: 'pnpm postprocess-api',
				injectGeneratedDirsAndFiles: false,
			},
		},
	},
});
