/**
 * png.mjs — 最小 PNG 编解码（只做验证工具用，不进游戏运行时）
 *
 * 支持：8bit、非隔行、灰度/灰度+alpha/调色板/RGB/RGBA 解码；
 *        RGBA(6) 编码（filter 0，足够生成校验图）。
 * 用途：Node 侧分析角色原画的 alpha 轮廓，以及软渲染输出网格变形结果 PNG。
 */
import { deflateSync, inflateSync } from "node:zlib";

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
    const table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        table[n] = c;
    }
    return table;
})();

function crc32(buffer) {
    let c = 0xffffffff;
    for (let i = 0; i < buffer.length; i++) c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}

function paeth(a, b, c) {
    const p = a + b - c;
    const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/**
 * @returns {{width:number,height:number,channels:number,colorType:number,data:Uint8Array}}
 *          data 统一展开成 RGBA 交错（4 通道）。
 */
export function decodePng(buffer) {
    if (!buffer.subarray(0, 8).equals(PNG_SIG)) throw new Error("不是 PNG 文件");
    let offset = 8;
    let header = null;
    let palette = null;
    let transparency = null;
    const idat = [];
    while (offset + 8 <= buffer.length) {
        const length = buffer.readUInt32BE(offset);
        const type = buffer.toString("ascii", offset + 4, offset + 8);
        const data = buffer.subarray(offset + 8, offset + 8 + length);
        if (type === "IHDR") {
            header = {
                width: data.readUInt32BE(0),
                height: data.readUInt32BE(4),
                bitDepth: data[8],
                colorType: data[9],
                interlace: data[12],
            };
        } else if (type === "PLTE") palette = Buffer.from(data);
        else if (type === "tRNS") transparency = Buffer.from(data);
        else if (type === "IDAT") idat.push(Buffer.from(data));
        else if (type === "IEND") break;
        offset += 12 + length;
    }
    if (!header) throw new Error("PNG 缺少 IHDR");
    if (header.bitDepth !== 8) throw new Error(`只支持 8bit，收到 ${header.bitDepth}`);
    if (header.interlace !== 0) throw new Error("不支持隔行 PNG");

    const channelsOf = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
    const srcChannels = channelsOf[header.colorType];
    if (!srcChannels) throw new Error(`不支持的颜色类型 ${header.colorType}`);

    const raw = inflateSync(Buffer.concat(idat));
    const stride = header.width * srcChannels;
    const lines = Buffer.alloc(header.height * stride);
    let pos = 0;
    for (let y = 0; y < header.height; y++) {
        const filter = raw[pos++];
        const line = raw.subarray(pos, pos + stride);
        pos += stride;
        const prev = y ? lines.subarray((y - 1) * stride, y * stride) : null;
        const cur = lines.subarray(y * stride, (y + 1) * stride);
        for (let x = 0; x < stride; x++) {
            const a = x >= srcChannels ? cur[x - srcChannels] : 0;
            const b = prev ? prev[x] : 0;
            const c = prev && x >= srcChannels ? prev[x - srcChannels] : 0;
            const v = line[x];
            cur[x] = filter === 0 ? v
                : filter === 1 ? (v + a) & 255
                    : filter === 2 ? (v + b) & 255
                        : filter === 3 ? (v + ((a + b) >> 1)) & 255
                            : (v + paeth(a, b, c)) & 255;
        }
    }

    const { width, height, colorType } = header;
    const data = new Uint8Array(width * height * 4);
    for (let i = 0, p = 0; i < width * height; i++, p += srcChannels) {
        let r, g, b, a = 255;
        if (colorType === 0) { r = g = b = lines[p]; }
        else if (colorType === 4) { r = g = b = lines[p]; a = lines[p + 1]; }
        else if (colorType === 2) { r = lines[p]; g = lines[p + 1]; b = lines[p + 2]; }
        else if (colorType === 6) { r = lines[p]; g = lines[p + 1]; b = lines[p + 2]; a = lines[p + 3]; }
        else {
            const index = lines[p];
            r = palette[index * 3]; g = palette[index * 3 + 1]; b = palette[index * 3 + 2];
            if (transparency && index < transparency.length) a = transparency[index];
        }
        data[i * 4] = r; data[i * 4 + 1] = g; data[i * 4 + 2] = b; data[i * 4 + 3] = a;
    }
    return { width, height, channels: 4, colorType, data };
}

function chunk(type, payload) {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(payload.length, 0);
    const body = Buffer.concat([Buffer.from(type, "ascii"), payload]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body), 0);
    return Buffer.concat([length, body, crc]);
}

/** @param {{width:number,height:number,data:Uint8Array}} image RGBA 交错 */
export function encodePng(image) {
    const { width, height, data } = image;
    const stride = width * 4;
    const raw = Buffer.alloc(height * (stride + 1));
    for (let y = 0; y < height; y++) {
        raw[y * (stride + 1)] = 0; // filter: None
        Buffer.from(data.buffer, data.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
    return Buffer.concat([
        PNG_SIG,
        chunk("IHDR", ihdr),
        chunk("IDAT", deflateSync(raw, { level: 6 })),
        chunk("IEND", Buffer.alloc(0)),
    ]);
}

/** 采样（最近邻），越界返回全透明。 */
export function sampleNearest(image, x, y, out = [0, 0, 0, 0]) {
    const xi = Math.round(x), yi = Math.round(y);
    if (xi < 0 || yi < 0 || xi >= image.width || yi >= image.height) {
        out[0] = out[1] = out[2] = out[3] = 0;
        return out;
    }
    const p = (yi * image.width + xi) * 4;
    out[0] = image.data[p]; out[1] = image.data[p + 1]; out[2] = image.data[p + 2]; out[3] = image.data[p + 3];
    return out;
}

/** 双线性采样（RGBA 预乘处理），用于软渲染抗锯齿。 */
export function sampleBilinear(image, x, y, out = [0, 0, 0, 0]) {
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = x - x0, fy = y - y0;
    let r = 0, g = 0, b = 0, a = 0;
    for (let j = 0; j < 2; j++) {
        for (let i = 0; i < 2; i++) {
            const xi = x0 + i, yi = y0 + j;
            if (xi < 0 || yi < 0 || xi >= image.width || yi >= image.height) continue;
            const w = (i ? fx : 1 - fx) * (j ? fy : 1 - fy);
            if (w <= 0) continue;
            const p = (yi * image.width + xi) * 4;
            const alpha = image.data[p + 3] / 255;
            r += image.data[p] * w * alpha;
            g += image.data[p + 1] * w * alpha;
            b += image.data[p + 2] * w * alpha;
            a += alpha * w;
        }
    }
    if (a > 0.0001) { out[0] = r / a; out[1] = g / a; out[2] = b / a; }
    else { out[0] = out[1] = out[2] = 0; }
    out[3] = Math.min(255, a * 255);
    return out;
}
