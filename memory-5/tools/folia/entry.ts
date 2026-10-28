import { SonnetPixiRuntime } from './upstream/src/components/visualizer/sonnet/createSonnetPixiRuntime';
import { compileSonnetProgram } from './upstream/src/components/visualizer/sonnet/sonnetProgram';
import { DEFAULT_SONNET_TUNING } from './upstream/src/types';

// Folia's original Sonnet director. Sekai owns audio, navigation and absolute time.
window.__createSekaiFolia = async ({ host, rows, seed, reducedMotion, title, artist }) => {
    const lines = rows.map((row, index) => {
        const startTime = Number(row.dataset.time);
        const endTime = Math.max(startTime + 0.067, Number(rows[index + 1]?.dataset.time ?? startTime + 6));
        const fullText = row.querySelector('b')?.textContent.trim() || '';
        // LRC only supplies line timing. Keep the full line visible from its start,
        // rather than claiming estimated character timing is authored karaoke timing.
        return { id: `sekai-${index}`, startTime, endTime, fullText,
            words: [{ text: fullText, startTime, endTime: startTime }], isChorus: false };
    });
    const program = compileSonnetProgram(lines, seed);
    let time = 0;
    const runtime = await SonnetPixiRuntime.create({
        host, program, songSeed: seed,
        theme: { name: 'Sekai Sonnet', backgroundColor: '#121019', primaryColor: '#fff7ee',
            accentColor: '#ffaf7d', secondaryColor: '#8eced7', fontStyle: 'serif',
            fontFamily: 'Yu Mincho', fontWeight: 700, animationIntensity: reducedMotion ? 'calm' : 'normal',
            lyricsIcons: ['Flower', 'Sparkles', 'Orbit'] },
        tuning: { ...DEFAULT_SONNET_TUNING, textureResolution: 1,
            cameraIntensity: reducedMotion ? 0 : 1, typographyMotion: reducedMotion ? 0 : 1 },
        currentTime: { get: () => time }, audioPower: { get: () => 0 },
        lyricsFontScale: 1, staticMode: reducedMotion, transparentBackground: true,
        paused: true, songTitle: title, songArtist: artist
    });
    return { apply(t) { time = t; runtime.renderOnce(); }, destroy() { runtime.destroy(); },
        program: { lines: lines.length, paragraphs: program.paragraphs.length,
            lossless: program.paragraphs.flatMap(p => p.lines).every(line =>
                line.segments.map(segment => segment.text).join('') === line.line.fullText),
            shots: program.paragraphs.flatMap(p => p.shots.map(s => s.kind)) } };
};
