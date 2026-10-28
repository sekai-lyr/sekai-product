import { build } from 'file:///D:/dsh-render/local-player-build/node_modules/esbuild/lib/main.js';
import { fileURLToPath } from 'node:url';
import { readdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
await build({entryPoints:[fileURLToPath(new URL('metadata-entry.mjs',import.meta.url))],
    outfile:fileURLToPath(new URL('../../src/main/resources/static/js/vendor/local-metadata.js',import.meta.url)),
    bundle:true,platform:'browser',format:'iife',target:'es2022',minify:true,legalComments:'linked',
    nodePaths:['D:/dsh-render/local-player-build/node_modules']});
const modules='D:/dsh-render/local-player-build/node_modules';
const packages=readdirSync(modules).filter(name=>!name.startsWith('.')).flatMap(name=>name.startsWith('@')
    ? readdirSync(join(modules,name)).map(child=>join(modules,name,child)) : [join(modules,name)]);
const notices=[];
for(const folder of packages){
    const manifest=join(folder,'package.json');if(!existsSync(manifest))continue;
    const info=JSON.parse(readFileSync(manifest,'utf8'));
    const license=['LICENSE','LICENSE.txt','LICENSE.md','license','license.md'].map(name=>join(folder,name)).find(existsSync);
    if(license)notices.push(`${info.name} ${info.version}\n${readFileSync(license,'utf8')}`);
}
writeFileSync(fileURLToPath(new URL('../../src/main/resources/static/js/vendor/LOCAL-METADATA-NOTICES.txt',import.meta.url)),notices.join('\n\n----------------\n\n'));
