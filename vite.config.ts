import { defineConfig } from 'vite';
import path from 'node:path';
import electron from 'vite-plugin-electron/simple';

export default defineConfig({
    plugins: [
        electron({
            main: {
                entry: 'electron/main.ts',
                vite: {
                    build: {
                        rollupOptions: {
                            external: ['ffmpeg-static', 'fluent-ffmpeg'],
                        },
                    },
                },
            },
            preload: {
                input: 'electron/preload.ts',
            },
        }),
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        }
    },
    build: {
        outDir: 'dist',
        emptyOutDir: true,
    }
});
