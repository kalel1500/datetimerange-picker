import { defineConfig, loadEnv } from 'vite';
// @ts-ignore
import path from 'path';

type StrBoolean = 'true' | 'false';
type Env = {
    VITE_MINIFY: StrBoolean,
    VITE_SOURCEMAP: StrBoolean,
}

export default ({ mode }: { mode: string }) => {
    const env = loadEnv(mode, process.cwd()) as Env;
    const minify = env.VITE_MINIFY === 'true';
    const sourcemap = env.VITE_SOURCEMAP === 'true';

    return defineConfig({
        build: {
            lib: {
                entry: [
                    path.resolve(__dirname, './src/index.js'),
                    path.resolve(__dirname, './src/styles/datetimerange-picker.css'),
                    path.resolve(__dirname, './src/styles/datetimerange-picker-dark.css'),
                ],
                name: 'DatetimerangePicker',
                formats: ['es'],
                fileName: (format, entryName) => {
                    // Usa el nombre original del archivo para los archivos CSS
                    if (entryName.endsWith('.css')) {
                        return `${entryName}`;
                    }
                    // Para el archivo JS, puedes usar un nombre específico o el nombre de la entrada
                    return `datetimerange-picker.${format}.js`;
                }
            },
            cssCodeSplit: true,
            minify: minify,
            sourcemap: sourcemap,
        }
    });
}
