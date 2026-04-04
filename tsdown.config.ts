import { defineConfig } from 'tsdown';

export default defineConfig({
	entry: ['src/**/*.ts', '!src/**/*.d.ts'],
	format: 'esm',
	platform: 'node',
	outDir: 'dist',
	unbundle: true,
	sourcemap: true,
	clean: true,
	outExtensions: () => ({ js: '.js' }),
	deps: {
		skipNodeModulesBundle: true,
	},
});
