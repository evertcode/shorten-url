import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const root = resolve(import.meta.dirname, 'web');

export default defineConfig({
	root,
	build: {
		outDir: resolve(import.meta.dirname, 'dist'),
		emptyOutDir: true,
		rollupOptions: {
			input: {
				index: resolve(root, 'index.html'),
				notFound: resolve(root, '404.html'),
			},
		},
	},
});
