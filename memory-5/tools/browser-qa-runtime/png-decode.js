/* 极简 PNG 解码器（仅支持 Chrome 截图使用的 8bit / 非隔行 / 真彩 PNG）
   用于验收脚本直接从渲染结果里量取像素，而不是依赖命中测试。 */
const zlib = require('zlib');

const decodePng = (buffer) => {
    let position = 8;
    let width = 0;
    let height = 0;
    let bitDepth = 0;
    let colorType = 0;
    let interlace = 0;
    const chunks = [];

    while (position + 8 <= buffer.length) {
        const length = buffer.readUInt32BE(position);
        const type = buffer.toString('ascii', position + 4, position + 8);
        const data = buffer.subarray(position + 8, position + 8 + length);
        if (type === 'IHDR') {
            width = data.readUInt32BE(0);
            height = data.readUInt32BE(4);
            bitDepth = data[8];
            colorType = data[9];
            interlace = data[12];
        } else if (type === 'IDAT') {
            chunks.push(data);
        } else if (type === 'IEND') {
            break;
        }
        position += 12 + length;
    }

    if (bitDepth !== 8 || interlace !== 0) {
        throw new Error(`不支持的 PNG 格式 bitDepth=${bitDepth} interlace=${interlace}`);
    }

    const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 0 ? 1 : 0;
    if (!channels) {
        throw new Error(`不支持的 PNG 颜色类型 ${colorType}`);
    }

    const raw = zlib.inflateSync(Buffer.concat(chunks));
    const stride = width * channels;
    const pixels = Buffer.alloc(height * stride);
    let offset = 0;

    for (let y = 0; y < height; y += 1) {
        const filter = raw[offset];
        offset += 1;
        const line = raw.subarray(offset, offset + stride);
        offset += stride;
        const current = pixels.subarray(y * stride, (y + 1) * stride);
        const previous = y > 0 ? pixels.subarray((y - 1) * stride, y * stride) : null;

        for (let index = 0; index < stride; index += 1) {
            const a = index >= channels ? current[index - channels] : 0;
            const b = previous ? previous[index] : 0;
            const c = previous && index >= channels ? previous[index - channels] : 0;
            const value = line[index];
            let result;
            switch (filter) {
                case 1: result = value + a; break;
                case 2: result = value + b; break;
                case 3: result = value + ((a + b) >> 1); break;
                case 4: {
                    const p = a + b - c;
                    const pa = Math.abs(p - a);
                    const pb = Math.abs(p - b);
                    const pc = Math.abs(p - c);
                    result = value + (pa <= pb && pa <= pc ? a : (pb <= pc ? b : c));
                    break;
                }
                default: result = value;
            }
            current[index] = result & 0xff;
        }
    }

    return {
        width,
        height,
        channels,
        at(x, y) {
            const index = (y * width + x) * channels;
            return [pixels[index], pixels[index + 1], pixels[index + 2]];
        }
    };
};

/* 颜色归类：面板临时刷成纯色后，用像素判断哪张页面真的画在了这个位置。
   正面页/侧面页用色相判据（对阴影压暗不敏感），队列页只认探针那一支纯蓝的精确色，
   避免背景图里的蓝色霓虹被误判成“队列页露出来了”。 */
const QUEUE_PROBE_RGB = [47, 106, 255];
const QUEUE_TOLERANCE = 30;

const classify = ([r, g, b]) => {
    if (Math.hypot(r - QUEUE_PROBE_RGB[0], g - QUEUE_PROBE_RGB[1], b - QUEUE_PROBE_RGB[2]) < QUEUE_TOLERANCE) return 'blue';
    if (r - Math.max(g, b) > 30 && r > 60) return 'red';
    if (g - Math.max(r, b) > 35 && g > 60) return 'green';
    return 'other';
};

const MIN_RUN = 24;

const runsOf = (image, y, kind) => {
    const runs = [];
    let start = -1;
    for (let x = 0; x < image.width; x += 1) {
        const match = classify(image.at(x, y)) === kind;
        if (match && start < 0) start = x;
        if (!match && start >= 0) {
            runs.push([start, x - 1]);
            start = -1;
        }
    }
    if (start >= 0) runs.push([start, image.width - 1]);
    return runs.filter((run) => run[1] - run[0] + 1 >= MIN_RUN);
};

const scanRows = (image, rows) => rows.map((ratio) => {
    const y = Math.min(image.height - 1, Math.max(0, Math.round(image.height * ratio)));
    const redRuns = runsOf(image, y, 'red');
    const greenRuns = runsOf(image, y, 'green');
    const blueRuns = runsOf(image, y, 'blue');

    /* 接缝 = 距离最近、且左右相邻的一对 正面页 / 侧面页 */
    let best = null;
    redRuns.forEach((red) => {
        greenRuns.forEach((green) => {
            if (green[0] <= red[1]) return;
            const gap = green[0] - red[1] - 1;
            if (!best || gap < best.gap) best = {gap, red, green};
        });
    });

    const widest = (runs) => runs.reduce((list, run) => [...list, run[1] - run[0] + 1], [0]);
    return {
        y,
        redPx: Math.max(...widest(redRuns)),
        greenPx: Math.max(...widest(greenRuns)),
        bluePx: Math.max(...widest(blueRuns)),
        redRuns,
        greenRuns,
        blueRuns,
        seamGap: best ? best.gap : null,
        seamRed: best ? best.red : null,
        seamGreen: best ? best.green : null,
        bothPages: Boolean(best)
    };
});

module.exports = {decodePng, scanRows, classify};
