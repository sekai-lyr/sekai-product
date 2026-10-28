import { build } from 'file:///D:/dsh-render/folia-sekai-build/node_modules/esbuild/lib/main.js';
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
await build({ entryPoints: ['tools/folia/entry.ts'], bundle: true, minify: true,
    format: 'iife', platform: 'browser', target: 'es2022',
    nodePaths: ['D:/dsh-render/folia-sekai-build/node_modules'],
    define: { 'process.env.NODE_ENV': '"production"' }, legalComments: 'linked',
    outfile: 'src/main/resources/static/js/vendor/folia-sonnet.js',
    plugins: [{ name: 'sekai-viewport', setup(api) {
        api.onLoad({ filter: /createSonnetPixiRuntime\.ts$/ }, ({path}) => {
            const source=readFileSync(path,'utf8'),anchor='scene.container.rotation = transitionFrame.rotation * transitionMotionScale;';
            if(!source.includes(anchor))throw Error('Sonnet viewport patch anchor changed');
            return {contents:source.replace(anchor,anchor+readFileSync('tools/folia/sonnet-viewport-guard.txt','utf8')),loader:'ts'};
        });
    }}],
    metafile: true }).then(result => {
        // Mechanical source vendoring: preserve the unmodified upstream dependency closure.
        for (const input of Object.keys(result.metafile.inputs)) {
            const normalized = input.replaceAll('\\', '/');
            const marker = 'folia-major-source/';
            if (!normalized.includes(marker)) continue;
            const target = 'tools/folia/upstream/' + normalized.split(marker)[1];
            mkdirSync(dirname(target), { recursive: true });
            copyFileSync(input, target);
        }
        console.log(JSON.stringify({ modules: Object.keys(result.metafile.inputs).length,
            bytes: Object.values(result.metafile.outputs).reduce((sum, output) => sum + output.bytes, 0) }));
    });
