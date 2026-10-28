import { build } from 'file:///D:/dsh-render/folia-sekai-build/node_modules/esbuild/lib/main.js';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, globSync, existsSync } from 'node:fs';
import { resolve, dirname, extname, relative } from 'node:path';

// Keep upstream snapshots intact; apply the documented Sekai viewport guard at build time.
const source = resolve(process.env.FOLIA_SOURCE || 'D:/dsh-render/folia-major-source');
const output = 'src/main/resources/static/js/vendor/folia-gallery';
const result = await build({
    entryPoints: { gallery: 'tools/folia/gallery.tsx' }, outdir: output,
    bundle: true, splitting: true, format: 'esm', platform: 'browser', target: 'es2022', publicPath: '/js/vendor/folia-gallery',
    minify: true, metafile: true, legalComments: 'linked',
    nodePaths: ['D:/dsh-render/folia-sekai-build/node_modules'],
    alias: { '@': `${source}/src`, 'folia-upstream': `${source}/src` },
    define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env.DEV': 'false', 'import.meta.env.PROD': 'true', 'import.meta.env.BASE_URL': '"/"' },
    loader: { '.png': 'file', '.jpg': 'file', '.jpeg': 'file', '.gif': 'file', '.webp': 'file', '.svg': 'file', '.woff2': 'file', '.glsl': 'text' },
    plugins: [{ name: 'upstream-vite-globs', setup(api) {
        api.onLoad({ filter: /\.[tj]sx?$/ }, ({ path }) => {
            let contents = readFileSync(path, 'utf8');
            if (path.replaceAll('\\', '/').endsWith('/sonnet/createSonnetPixiRuntime.ts')) {
                const anchor = 'scene.container.rotation = transitionFrame.rotation * transitionMotionScale;';
                if (!contents.includes(anchor)) throw new Error('Sonnet viewport patch anchor changed');
                contents = contents.replace(anchor, anchor + readFileSync('tools/folia/sonnet-viewport-guard.txt', 'utf8'));
                return { contents, loader: 'ts' };
            }
            if (path.replaceAll('\\', '/').endsWith('/tempera/createTemperaPixiRuntime.ts')) {
                const anchor = 'scene.container.rotation = transitionFrame.rotation;';
                if (!contents.includes(anchor)) throw new Error('Tempera viewport patch anchor changed');
                const guard = readFileSync('tools/folia/sonnet-viewport-guard.txt', 'utf8')
                    .replace(/const foreground = [\s\S]*?\?\? \[\];/, 'const foreground = scene.shots[activeShotIndex]?.glyphs.map(glyph => glyph.display) ?? [];')
                    .replaceAll('scene.container', 'scene.shots[activeShotIndex].container');
                contents = contents.replace(anchor, anchor + guard);
                return { contents, loader: 'ts' };
            }
            if (path.replaceAll('\\', '/').endsWith('/partita/VisualizerPartita.tsx')) {
                contents = contents.replace("padding: '0.2rem 0.5rem'", "padding: '1.2rem 1rem'")
                    .replace('scale: config.scale,', 'scale: Math.min(1, config.scale),')
                    .replace('scale: isNaN(config.scale) ? 1.5 : config.scale * 1.4,', 'scale: Math.min(1, config.scale || 1),')
                    .replace('y: config.y,', 'y: Math.max(-8, Math.min(8, config.y)),')
                    .replace('x: config.x,', 'x: Math.max(-8, Math.min(8, config.x)),');
                return { contents, loader: 'tsx' };
            }
            if (path.replaceAll('\\', '/').endsWith('/cadenza/VisualizerCadenza.tsx')) {
                contents = contents.replace("const passedRotate = (random(3) - 0.5) * (animationIntensity === 'chaotic' ? 20 : 12);", 'const passedRotate = 0;')
                    .replace('Math.max(lineHeight * 2.2, collisionWidth * 0.75, 56)', 'Math.max(lineHeight * 5, collisionWidth * 1.5, 100)')
                    .replace('passedDriftX,\n            passedDriftY,', 'passedDriftX: passedDriftX * .15,\n            passedDriftY: passedDriftY * .15,');
                const anchor = '    return {\n        prepared,';
                const normalized = contents.replaceAll('\r\n', '\n');
                if (!normalized.includes(anchor)) throw new Error('Cadenza layout patch anchor changed');
                contents = normalized.replace(anchor, readFileSync('tools/folia/cadenza-layout-guard.txt', 'utf8') + '\n' + anchor);
                return { contents, loader: 'tsx' };
            }
            if (path.replaceAll('\\', '/').endsWith('/diorama/CameraRig.tsx')) {
                contents = contents.replace('    if (timeline.length === 0) return 0;', "    if (line.renderHints?.wordRevealMode === 'instant') return .5;\n    if (timeline.length === 0) return 0;")
                    .replace('    useFrame((state, delta) => {', `
                    const fitPoint = useMemo(() => new THREE.Vector3(), []);
                    const fitOffset = useMemo(() => new THREE.Vector3(), []);
                    const previousAudioTime = useRef<number | null>(null);
                    useFrame((state, delta) => {`)
                    .replace('const now = currentTime.get();', `const now = currentTime.get();
                        const audioSeek = previousAudioTime.current !== null && Math.abs(now - previousAudioTime.current) > .25;
                        previousAudioTime.current = now;`)
                    .replace('const snapped = !flying && posGap > DIORAMA_SNAP_DISTANCE;', 'const snapped = audioSeek || (!flying && posGap > DIORAMA_SNAP_DISTANCE);')
                    .replace('if (bank !== 0) camera.rotateZ(bank);', `if (bank !== 0) camera.rotateZ(bank);
                        // Keep the full active lyric plane within the central readable frame.
                        if (line && activeLineWidthRef.current > 0) {
                            camera.updateMatrixWorld();
                            let extent = 0;
                            for (const side of [-1, 1]) {
                                fitPoint.set(baseX + R.x * activeLineWidthRef.current * .55 * side,
                                    baseY + R.y * activeLineWidthRef.current * .55 * side,
                                    baseZ + R.z * activeLineWidthRef.current * .55 * side).project(camera);
                                extent = Math.max(extent, Math.abs(fitPoint.x) / .82, Math.abs(fitPoint.y) / .62);
                            }
                            if (extent > 1) {
                                fitPoint.set(baseX, baseY, baseZ);
                                camera.lookAt(fitPoint); camera.updateMatrixWorld();
                                extent = 1;
                                for (const side of [-1, 1]) {
                                    fitPoint.set(baseX + R.x * activeLineWidthRef.current * .55 * side,
                                        baseY + R.y * activeLineWidthRef.current * .55 * side,
                                        baseZ + R.z * activeLineWidthRef.current * .55 * side).project(camera);
                                    extent = Math.max(extent, Math.abs(fitPoint.x) / .82, Math.abs(fitPoint.y) / .62);
                                }
                                fitPoint.set(baseX, baseY, baseZ);
                                fitOffset.copy(camera.position).sub(fitPoint).multiplyScalar(Math.min(4, extent));
                                camera.position.copy(fitPoint).add(fitOffset); camera.lookAt(fitPoint);
                                camera.updateMatrixWorld();
                            }
                        }`);
                return { contents, loader: 'tsx' };
            }
            if (path.replaceAll('\\', '/').endsWith('/fume/useFumeCanvasStage.ts')) {
                const anchor = 'const screenScale = camera.scale;';
                if (!contents.includes(anchor)) throw new Error('Fume viewport patch anchor changed');
                contents = contents.replace(anchor, `
                    const activeBlocks = article.blocks.filter(block => block.sourceLineIndex === driver.getLineIndex());
                    if (activeBlocks.length) {
                        const left = Math.min(...activeBlocks.map(block => block.x));
                        const right = Math.max(...activeBlocks.map(block => block.x + block.width));
                        const top = Math.min(...activeBlocks.map(block => block.y));
                        const bottom = Math.max(...activeBlocks.map(block => block.y + block.height));
                        camera.scale = Math.min(camera.scale, currentWidth * .88 / Math.max(1, right - left), currentHeight * .6 / Math.max(1, bottom - top));
                        const halfWidth = currentWidth * .44 / camera.scale;
                        const halfHeight = currentHeight * .3 / camera.scale;
                        camera.x = Math.max(right - halfWidth, Math.min(left + halfWidth, camera.x));
                        camera.y = Math.max(bottom - halfHeight, Math.min(top + halfHeight, camera.y));
                    }
                    const screenScale = camera.scale;`);
                contents = contents.replace('draw();\n        return () => {', "draw();\n        const stopSeek = paused ? driver.currentTime.on('change', draw) : () => {};\n        return () => {\n            stopSeek();");
                return { contents, loader: 'ts' };
            }
            if (!contents.includes('import.meta.glob')) return;
            let imports = '', count = 0;
            contents = contents.replace(/import\.meta\.glob(?:<[^>]+>)?\(\s*(['"])([^'"]+)\1\s*,\s*\{\s*eager:\s*true\s*\}\s*,?\s*\)/g, (_, quote, pattern) => {
                const matches = [...globSync(pattern, { cwd: dirname(path) })].sort();
                return '{' + matches.map(file => {
                    const name = `__glob${count++}`;
                    const ref = './' + file.replaceAll('\\', '/');
                    imports += `import * as ${name} from ${JSON.stringify(ref)};\n`;
                    return `${JSON.stringify(ref)}:${name}`;
                }).join(',') + '}';
            });
            if (/import\.meta\.glob\s*[<(]/.test(contents)) throw new Error(`Unexpanded glob: ${path}`);
            return { contents: imports + contents, loader: extname(path).slice(1) };
        });
    } }] });
const vendored = resolve('tools/folia/gallery-upstream');
for (const input of Object.keys(result.metafile.inputs)) {
    const full = resolve(input);
    if (!full.startsWith(source + '\\') && !full.startsWith(source + '/')) continue;
    const target = resolve(vendored, relative(source, full));
    mkdirSync(dirname(target), { recursive: true }); copyFileSync(full, target);
}
for (const file of ['LICENSE', 'package.json', 'package-lock.json']) {
    if (existsSync(resolve(source, file))) copyFileSync(resolve(source, file), resolve(vendored, file));
}
mkdirSync('D:/dsh-render/folia-gallery', { recursive: true });
writeFileSync('D:/dsh-render/folia-gallery/metafile.json', JSON.stringify(result.metafile));
console.log(JSON.stringify({ modules: Object.keys(result.metafile.inputs).length, outputs: Object.keys(result.metafile.outputs).length }));
