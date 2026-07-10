import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';

// Browser-dev target: the DroppedNeedle server the Vite proxy forwards /api + /health to.
// Defaults to the dev sandbox; override with DN_DEV_TARGET=https://your-server pnpm dev
const devTarget = process.env.DN_DEV_TARGET ?? 'http://127.0.0.1:8689';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			// SPA mode: single fallback page, no prerendering (mirrors upstream DroppedNeedle)
			adapter: adapter({ fallback: 'index.html' })
		})
	],
	server: {
		port: 5173,
		strictPort: true,
		host: true, // bind all interfaces so the saltbox dev server is reachable from the LAN
		proxy: {
			'/api': { target: devTarget, changeOrigin: true },
			'/health': { target: devTarget, changeOrigin: true }
		}
	},
	clearScreen: false,
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
