/**
 * controller-mesh-gl.js — 网格模型的 WebGL 渲染后端
 *
 * 分工：controller-mesh.js 在 CPU 上算好变形后的顶点位置，
 * 这里只负责把「纹理 + 三角形 + UV」画出来。因此着色器极简、
 * 没有骨骼 uniform 数组，也不需要浮点纹理。
 *
 * 兼容策略：
 *   · 优先 WebGL2（原生支持非 2 次幂纹理的 mipmap，缩小采样不闪烁）
 *   · 退回 WebGL1 时，把纹理预缩放到「约 2× 显示宽度」再用 LINEAR 采样，
 *     把缩小比例压到 1~2 倍，避免长发这类高频细节出现摩尔纹
 *   · 两者都拿不到就直接返回 null，调用方回退到静态图后端（不影响决斗）
 */

const VERTEX_SHADER = `
attribute vec2 aPos;
attribute vec2 aUV;
uniform vec4 uFit;      // xy = 缩放, zw = 画布内偏移(px)
uniform vec2 uCanvas;   // 画布尺寸(px)
varying vec2 vUV;
void main() {
    vec2 p = aPos * uFit.xy + uFit.zw;
    vec2 clip = vec2(p.x / uCanvas.x * 2.0 - 1.0, 1.0 - p.y / uCanvas.y * 2.0);
    gl_Position = vec4(clip, 0.0, 1.0);
    vUV = aUV;
}`;

const FRAGMENT_SHADER = `
precision mediump float;
uniform sampler2D uTex;
uniform float uAlpha;
varying vec2 vUV;
void main() {
    vec4 c = texture2D(uTex, vUV);
    if (c.a < 0.004) discard;
    gl_FragColor = vec4(c.rgb * uAlpha, c.a * uAlpha);
}`;

function compile(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(`着色器编译失败: ${log}`);
    }
    return shader;
}

function createProgram(gl) {
    const program = gl.createProgram();
    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const log = gl.getProgramInfoLog(program);
        gl.deleteProgram(program);
        throw new Error(`着色器链接失败: ${log}`);
    }
    return program;
}

/** 把源图缩放到目标宽度（用于 WebGL1 的降采样纹理）。 */
function resizeImageSource(image, targetWidth) {
    const scale = targetWidth / image.width;
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, 0, 0, width, height);
    return canvas;
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {HTMLImageElement|HTMLCanvasElement} image 已加载完成的角色原画
 * @param {{mesh:object, positions:Float32Array}} model
 * @param {{maxTextureWidth?:number}} options
 */
export function createMeshRenderer(canvas, image, model, options = {}) {
    const attrs = { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false };
    let gl = canvas.getContext("webgl2", attrs);
    const isWebGL2 = !!gl;
    if (!gl) gl = canvas.getContext("webgl", attrs) || canvas.getContext("experimental-webgl", attrs);
    if (!gl) return null;

    let program;
    try {
        program = createProgram(gl);
    } catch (error) {
        console.warn("[主控网格] 渲染器初始化失败，回退静态图", error);
        return null;
    }

    const { mesh } = model;
    const locations = {
        aPos: gl.getAttribLocation(program, "aPos"),
        aUV: gl.getAttribLocation(program, "aUV"),
        uFit: gl.getUniformLocation(program, "uFit"),
        uCanvas: gl.getUniformLocation(program, "uCanvas"),
        uTex: gl.getUniformLocation(program, "uTex"),
        uAlpha: gl.getUniformLocation(program, "uAlpha"),
    };

    const positionBuffer = gl.createBuffer();
    const uvBuffer = gl.createBuffer();
    const indexBuffer = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.uvs, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);

    const positionUpload = new Float32Array(mesh.vertexCount * 2);

    // ---- 纹理 ----
    // WebGL1 无法对非 2 次幂纹理生成 mipmap；此时先降采样到接近显示尺寸，
    // 让缩小比例接近 1，避免长发细节走样。WebGL2 直接上传原图并生成 mipmap。
    const maxTextureWidth = options.maxTextureWidth || 1400;
    const textureSource = (!isWebGL2 && image.width > maxTextureWidth)
        ? resizeImageSource(image, maxTextureWidth)
        : image;

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textureSource);
    const potTexture = (textureSource.width & (textureSource.width - 1)) === 0
        && (textureSource.height & (textureSource.height - 1)) === 0;
    if (isWebGL2 || potTexture) {
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    } else {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.useProgram(program);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.DEPTH_TEST);
    gl.clearColor(0, 0, 0, 0);

    const state = {
        cssWidth: 0,
        cssHeight: 0,
        dpr: 1,
        /** object-fit:contain + object-position:center bottom 的等价参数 */
        fit: [1, 1, 0, 0],
    };

    function resize(cssWidth, cssHeight, dpr = window.devicePixelRatio || 1) {
        const width = Math.max(1, Math.round(cssWidth * dpr));
        const height = Math.max(1, Math.round(cssHeight * dpr));
        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
        }
        state.cssWidth = cssWidth;
        state.cssHeight = cssHeight;
        state.dpr = dpr;
        // 原图像素 → 画布设备像素
        const scale = Math.min(width / mesh.width, height / mesh.height);
        state.fit = [scale, scale, (width - mesh.width * scale) / 2, height - mesh.height * scale];
    }

    function render(positions, alpha = 1) {
        if (!state.cssWidth || !state.cssHeight) return;
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clear(gl.COLOR_BUFFER_BIT);
        if (alpha <= 0.001) return;

        // 位置上传到「设备像素」空间，直接在顶点着色器里做像素对齐
        const dpr = state.dpr;
        for (let i = 0; i < positions.length; i++) positionUpload[i] = positions[i] * dpr;

        gl.useProgram(program);
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, positionUpload, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(locations.aPos);
        gl.vertexAttribPointer(locations.aPos, 2, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
        gl.enableVertexAttribArray(locations.aUV);
        gl.vertexAttribPointer(locations.aUV, 2, gl.FLOAT, false, 0, 0);

        gl.uniform4f(locations.uFit, state.fit[0] / dpr, state.fit[1] / dpr, state.fit[2] / dpr, state.fit[3] / dpr);
        gl.uniform2f(locations.uCanvas, state.cssWidth, state.cssHeight);
        gl.uniform1f(locations.uAlpha, alpha);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniform1i(locations.uTex, 0);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.drawElements(gl.TRIANGLES, mesh.indices.length, gl.UNSIGNED_SHORT, 0);
    }

    function dispose() {
        gl.deleteBuffer(positionBuffer);
        gl.deleteBuffer(uvBuffer);
        gl.deleteBuffer(indexBuffer);
        gl.deleteTexture(texture);
        gl.deleteProgram(program);
        // 主动丢弃上下文，避免频繁换角色时累积 GPU 资源
        gl.getExtension("WEBGL_lose_context")?.loseContext();
    }

    return { isWebGL2, resize, render, dispose };
}
