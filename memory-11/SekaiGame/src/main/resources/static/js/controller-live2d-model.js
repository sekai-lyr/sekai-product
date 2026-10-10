/**
 * controller-live2d-model.js — Live2D Cubism 后端（可选后端 / 技术验证）
 *
 * 定位：
 *   游戏的两个出场主控（blue-01 / lucia）用自研网格后端；Live2D 后端是**可选能力**，
 *   目前以官方示例模型 hiyori 做技术验证，用来说明这套主控架构可以承载真正的
 *   Live2D 模型。默认不出场（注册表里标了 experimental，选择界面默认不显示）。
 *
 * 为什么把运行时和绘制拆开：
 *   Cubism 的模型求值（moc3 解析、动作、物理、呼吸、眨眼）完全不需要 WebGL，
 *   只有最后的 drawModel 需要。拆开之后 Node 里就能真实验证"运行时在动"，
 *   而不是只能验证"文件存在"。createLive2DCubismRuntime 不碰 canvas，
 *   createLive2DControllerModel 才负责渲染。
 *
 * 依赖（都已 vendor 进 static/js/vendor/live2d/）：
 *   live2dcubismcore.min.js      Live2D 官方 Core，非 ESM，必须先以 <script> 加载
 *   cubism-framework.esm.js      由 tools/fetch-live2d-framework.mjs 从官方 TS 源码打包
 *
 * 许可：Cubism Core 属 Live2D 专有软件（Redistributable Code），
 *       hiyori 属 Live2D 官方示例数据，使用需接受 Free Material License Agreement。
 *       详见 assets/models/hiyori/LICENSE-ReadMe.txt。
 */

const CORE_PATH = "js/vendor/live2d/live2dcubismcore.min.js";
/**
 * 框架 ESM 必须相对**本模块**解析，不能相对文档或写成裸说明符：
 *   import("js/vendor/...") 在浏览器里会变成 /js/js/vendor/...
 *   在 Node 里会被当成包名直接 ERR_MODULE_NOT_FOUND。
 */
const FRAMEWORK_URL = new URL("./vendor/live2d/cubism-framework.esm.js", import.meta.url).href;

/** Cubism 动作优先级（框架常量 CubismMotionPriority 的数值） */
export const MOTION_PRIORITY = { NONE: 0, IDLE: 1, NORMAL: 2, FORCE: 3 };

/* ------------------------------------------------------------------ *
 * 依赖加载：Core 是全局脚本，必须早于框架 ESM
 * ------------------------------------------------------------------ */
let corePromise = null;
let frameworkPromise = null;

export function ensureCubismCore(baseUrl = "") {
    if (corePromise) return corePromise;
    corePromise = new Promise((resolve, reject) => {
        if (typeof window === "undefined") { reject(new Error("Live2D Core 需要浏览器环境")); return; }
        if (window.Live2DCubismCore) { resolve(window.Live2DCubismCore); return; }
        const script = document.createElement("script");
        script.src = `${baseUrl}${CORE_PATH}`;
        script.async = false;
        script.onload = () => window.Live2DCubismCore
            ? resolve(window.Live2DCubismCore)
            : reject(new Error("Live2D Core 加载后未暴露 Live2DCubismCore"));
        script.onerror = () => reject(new Error("Live2D Core 加载失败"));
        document.head.appendChild(script);
    });
    return corePromise;
}

export async function loadCubismFramework(baseUrl = "") {
    if (frameworkPromise) return frameworkPromise;
    frameworkPromise = (async () => {
        await ensureCubismCore(baseUrl);
        const target = baseUrl ? `${baseUrl.replace(/\/+$/, "")}/js/vendor/live2d/cubism-framework.esm.js` : FRAMEWORK_URL;
        const module = await import(/* @vite-ignore */ target);
        const framework = module.default || module;
        framework.CubismFramework.startUp();
        framework.CubismFramework.initialize();
        return framework;
    })();
    return frameworkPromise;
}

/* ------------------------------------------------------------------ *
 * 资源读取
 * ------------------------------------------------------------------ */
function toArrayBuffer(text) {
    return new TextEncoder().encode(text).buffer;
}

async function fetchText(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`加载失败 ${response.status}: ${url}`);
    return response.text();
}

/**
 * fetch 二进制。moc3 / physics3 / pose3 都是二进制格式，
 * **必须**直接取 ArrayBuffer —— 曾经写成"转 latin1 字符串再 TextEncoder 编回"
 * 会破坏 >0x7F 的字节，moc3 直接解析失败。
 */
async function fetchArrayBuffer(url) {
    const response = await fetch(url, { cache: "force-cache" });
    if (!response.ok) throw new Error(`加载失败 ${response.status}: ${url}`);
    return response.arrayBuffer();
}

async function loadTextureImage(url) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error(`贴图加载失败: ${url}`));
        image.src = url;
    });
}

/* ------------------------------------------------------------------ *
 * 运行时（无 WebGL 依赖，Node 可测）
 * ------------------------------------------------------------------ */

/**
 * @param {object} options
 * @param {string} options.modelDir  形如 "assets/models/hiyori/"
 * @param {string} options.modelJson 形如 "hiyori_free_t08.model3.json"
 * @param {string} [options.baseUrl]
 * @param {boolean} [options.loadTextures] 浏览器里为 true；Node 验证时 false
 */
export async function createLive2DCubismRuntime({ modelDir, modelJson, baseUrl = "", loadTextures = true, log = console }) {
    const framework = await loadCubismFramework(baseUrl);
    const {
        CubismUserModel, CubismModelSettingJson, CubismEyeBlink, CubismBreath,
        BreathParameterData, CubismMatrix44,
    } = framework;

    const settingText = await fetchText(`${baseUrl}${modelDir}${modelJson}`);
    const settingBytes = toArrayBuffer(settingText);
    const setting = new CubismModelSettingJson(settingBytes, settingBytes.byteLength);

    const userModel = new CubismUserModel();
    const stats = { motions: 0, textures: 0, parameters: 0, drawables: 0, groups: [], hasPhysics: false, hasPose: false };

    // ---- moc3 ----
    userModel.loadModel(await fetchArrayBuffer(`${baseUrl}${modelDir}${setting.getModelFileName()}`), false);
    const model = userModel.getModel();
    if (!model) throw new Error("moc3 解析失败");
    stats.parameters = model.getParameterCount();
    stats.drawables = model.getDrawableCount();

    // ---- 贴图（只记录，实际上传由渲染层做）----
    const textureUrls = [];
    const textureDir = typeof setting.getTextureDirectory === "function" ? setting.getTextureDirectory() : "";
    for (let i = 0; i < setting.getTextureCount(); i++) {
        textureUrls.push(`${baseUrl}${modelDir}${textureDir}${setting.getTextureFileName(i)}`);
    }
    stats.textures = textureUrls.length;
    const textures = loadTextures
        ? await Promise.all(textureUrls.map(loadTextureImage))
        : [];

    // ---- 物理 / 姿势 ----
    if (setting.getPhysicsFileName()) {
        const bytes = await fetchArrayBuffer(`${baseUrl}${modelDir}${setting.getPhysicsFileName()}`);
        userModel.loadPhysics(bytes, bytes.byteLength);
        stats.hasPhysics = true;
    }
    if (setting.getPoseFileName && setting.getPoseFileName()) {
        const bytes = await fetchArrayBuffer(`${baseUrl}${modelDir}${setting.getPoseFileName()}`);
        userModel.loadPose(bytes, bytes.byteLength);
        stats.hasPose = true;
    }

    // ---- 自动眨眼 / 呼吸 ----
    const eyeBlink = CubismEyeBlink.create(setting);
    userModel._eyeBlink = eyeBlink;
    const breath = CubismBreath.create();
    const idManager = framework.CubismFramework.getIdManager();
    // 注意：Cubism 5-r.4 的 setParameters 要的是 csmVector（不是数组）。
    // GitHub develop 分支曾经改成接受数组，跨版本混用会炸在
    // "this._breathParameters.getSize is not a function"。
    const VectorCtor = framework.csmVector;
    const breathParameters = VectorCtor ? new VectorCtor() : [];
    const pushBreath = item => (typeof breathParameters.pushBack === "function"
        ? breathParameters.pushBack(item)
        : breathParameters.push(item));
    for (const [name, offset, peak, cycle, weight] of [
        ["ParamAngleX", 0, 15, 6.5345, 0.5],
        ["ParamAngleY", 0, 8, 3.5345, 0.5],
        ["ParamAngleZ", 0, 10, 5.5345, 0.5],
        ["ParamBodyAngleX", 0, 4, 15.5345, 0.5],
        ["ParamBreath", 0.5, 0.5, 3.2345, 0.5],
    ]) {
        pushBreath(new BreathParameterData(idManager.getId(name), offset, peak, cycle, weight));
    }
    breath.setParameters(breathParameters);
    userModel._breath = breath;

    // ---- 动作 ----
    const motionGroups = new Map();
    const motionManager = userModel._motionManager;
    for (let g = 0; g < setting.getMotionGroupCount(); g++) {
        const group = setting.getMotionGroupName(g);
        const list = [];
        for (let i = 0; i < setting.getMotionCount(group); i++) {
            // 注意：model3.json 里 motion 的 File 字段**已经包含** "motion/" 前缀
            // （例如 "motion/hiyori_m01.motion3.json"），不能再拼一次目录。
            const bytes = await fetchArrayBuffer(`${baseUrl}${modelDir}${setting.getMotionFileName(group, i)}`);
            // 必须把 modelSetting / group / index 传给 loadMotion：
            // CubismMotion.doUpdateParameters 会无条件读 _eyeBlinkParameterIds.getSize()，
            // 而这个字段只在带设定加载时才会被赋值；漏传就会在第一次 updateMotion 时抛
            // "Cannot read properties of null (reading 'getSize')"。
            const motion = userModel.loadMotion(
                bytes, bytes.byteLength, `${group}_${i}`,
                undefined, undefined, setting, group, i,
            );
            if (!motion) continue;
            const fadeIn = setting.getMotionFadeInTimeValue(group, i);
            const fadeOut = setting.getMotionFadeOutTimeValue(group, i);
            if (fadeIn >= 0) motion.setFadeInTime(fadeIn);
            if (fadeOut >= 0) motion.setFadeOutTime(fadeOut);
            motion.setLoop(group.toLowerCase() === "idle");
            list.push(motion);
            stats.motions++;
        }
        motionGroups.set(group, list);
        stats.groups.push(`${group}×${list.length}`);
    }
    model.saveParameters();

    const state = { time: 0, currentGroup: null, currentIndex: -1, dragging: [0, 0], opacity: 1 };
    /**
     * 每个子更新器单独隔离：Cubism 的某个部件（眨眼/姿势/物理）在模型缺对应设定时
     * 会内部崩掉，一次异常不该让整具模型停止渲染。
     * 但也不能静默吞掉 —— 错误会记在 updateErrors 里，验收脚本据此判定失败。
     */
    const updateErrors = new Map();
    const safeUpdate = (label, fn) => {
        if (typeof fn !== "function") return;
        try {
            fn();
        } catch (error) {
            if (!updateErrors.has(label)) updateErrors.set(label, String(error?.message || error));
        }
    };

    function startMotion(group, index = null, priority = MOTION_PRIORITY.NORMAL) {
        const list = motionGroups.get(group);
        if (!list || !list.length) return false;
        const pick = index === null || index === undefined ? Math.floor(Math.random() * list.length) : index % list.length;
        const motion = list[pick];
        if (!motion) return false;
        if (!motionManager.reserveMotion(priority)) return false;
        motionManager.startMotionPriority(motion, false, priority);
        state.currentGroup = group;
        state.currentIndex = pick;
        return true;
    }

    return {
        framework,
        userModel,
        model,
        setting,
        textures,
        textureUrls,
        motionGroups,
        stats,
        get currentMotion() { return { group: state.currentGroup, index: state.currentIndex }; },
        /** 主控状态 → Live2D 动作组；缺组时静默忽略 */
        playGroup(group, priority = MOTION_PRIORITY.NORMAL) { return startMotion(group, null, priority); },
        playRandomIdle() { return startMotion("Idle", null, MOTION_PRIORITY.IDLE); },
        setDragging(x, y) {
            state.dragging = [x, y];
            userModel.setDragging(x, y);
        },
        setOpacity(value) {
            state.opacity = Math.max(0, Math.min(1, value));
            userModel.setOpacity(state.opacity);
        },
        getParameterValue(name) {
            const id = idManager.getId(name);
            return model.getParameterValueById(id);
        },
        /** 采样所有参数值，用于验证运行时确实在动 */
        snapshotParameters() {
            const values = new Map();
            for (let i = 0; i < model.getParameterCount(); i++) {
                values.set(i, model.getParameterValueByIndex(i));
            }
            return values;
        },
        /** 推进一帧：动作 → 眨眼 → 呼吸 → 物理 → 姿势 → 提交 */
        update(dt) {
            if (!model) return;
            state.time += dt;
            if (motionManager.isFinished()) startMotion("Idle", null, MOTION_PRIORITY.IDLE);
            safeUpdate("eyeBlink", () => eyeBlink?.updateParameters(model, dt));
            safeUpdate("breath", () => breath?.updateParameters(model, dt));
            safeUpdate("physics", () => userModel._physics?.evaluate(model, dt));
            safeUpdate("pose", () => userModel._pose?.updateParameters(model, dt));
            safeUpdate("motion", () => motionManager.updateMotion(model, dt));
            model.update();
        },
        /** 各子更新器的失败原因（空 Map 表示一切正常） */
        get updateErrors() { return new Map(updateErrors); },
        /** 计算 MVP：把模型按 contain 方式放进画布 */
        computeMvp(canvasWidth, canvasHeight) {
            const matrix = new CubismMatrix44();
            if (canvasWidth < canvasHeight) matrix.scale(1, canvasWidth / canvasHeight);
            const modelMatrix = userModel.getModelMatrix();
            const modelAspect = model.getCanvasWidth() / model.getCanvasHeight();
            const viewAspect = canvasWidth / canvasHeight;
            if (modelAspect > viewAspect) modelMatrix.setWidth(2.0);
            else modelMatrix.setHeight(2.0);
            modelMatrix.setCenterPosition(0, 0);
            matrix.multiplyByMatrix(modelMatrix);
            return matrix;
        },
        dispose() {
            for (const motion of motionGroups.values()) for (const item of motion) item.release?.();
            motionGroups.clear();
            userModel.release?.();
        },
    };
}

/** fetch 二进制：Cubism 的 moc3/physics3 都是二进制，必须按 arrayBuffer 读 */

/* ------------------------------------------------------------------ *
 * 浏览器渲染层
 * ------------------------------------------------------------------ */

/**
 * 与 controller-mesh-model.js 相同的对外契约：
 *   start / stop / resize / playAction / setPersistent / reset / dispose / getDebugState
 * 因此 controller-2d.js 的状态机可以无差别驱动两种后端。
 */
export async function createLive2DControllerModel({ modelDir, modelJson, canvas, baseUrl = "", id = "", reducedMotion = false }) {
    const runtime = await createLive2DCubismRuntime({ modelDir, modelJson, baseUrl, loadTextures: true });
    const gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: true })
        || canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: true });
    if (!gl) throw new Error("WebGL 不可用");

    const { userModel, model } = runtime;
    const width = Math.max(1, canvas.width);
    const height = Math.max(1, canvas.height);
    userModel.createRenderer(width, height);
    const renderer = userModel.getRenderer();
    renderer.setIsPremultipliedAlpha(true);
    renderer.setRenderTargetSize(width, height);
    // Cubism 5 的渲染器通过 setGL 绑定上下文
    (renderer.setGL || renderer.setGl)?.call(renderer, gl);
    runtime.textures.forEach((image, index) => {
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        if (typeof gl.generateMipmap === "function") gl.generateMipmap(gl.TEXTURE_2D);
        renderer.bindTexture(index, texture);
    });

    // 主控状态 → Live2D 动作组。hiyori 的组名见 model3.json。
    const ACTION_TO_GROUP = {
        link: "Tap", draw: "Tap", play: "Tap", summon: "Tap@Body",
        spell: "FlickUp", trap: "FlickDown", attack: "Flick", hit: "Flick@Body",
        critical: "FlickDown", win: "Tap", lose: "FlickDown", drawGame: "FlickDown",
    };

    let running = false;
    let frame = 0;
    let last = 0;
    let frameCount = 0;
    const debug = { action: null, hold: null, lowHp: false, dim: 0 };

    function tick(now) {
        if (!running) return;
        frame = requestAnimationFrame(tick);
        const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
        last = now;
        runtime.update(reducedMotion ? 0 : dt);
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        renderer.setMvpMatrix(runtime.computeMvp(canvas.width, canvas.height));
        renderer.drawModel();
        frameCount++;
    }

    return {
        kind: "live2d",
        id,
        stats: runtime.stats,
        webgl2: typeof WebGL2RenderingContext !== "undefined" && gl instanceof WebGL2RenderingContext,
        runtime,
        start() {
            if (running) return;
            running = true;
            last = 0;
            frame = requestAnimationFrame(tick);
        },
        stop() {
            running = false;
            if (frame) cancelAnimationFrame(frame);
            frame = 0;
        },
        resize(cssWidth, cssHeight, dpr = 1) {
            const w = Math.max(1, Math.round(cssWidth * dpr));
            const h = Math.max(1, Math.round(cssHeight * dpr));
            if (canvas.width !== w || canvas.height !== h) {
                canvas.width = w;
                canvas.height = h;
            }
            renderer.setRenderTargetSize(w, h);
        },
        playAction(name) {
            const group = ACTION_TO_GROUP[name];
            if (!group) return false;
            debug.action = name;
            return runtime.playGroup(group, MOTION_PRIORITY.NORMAL);
        },
        setPersistent(name, active) {
            if (name === "lowHp") { debug.lowHp = !!active; return; }
            if (active) {
                debug.hold = name;
                if (name === "win") runtime.playGroup("Tap@Body", MOTION_PRIORITY.FORCE);
                else runtime.playGroup("FlickDown", MOTION_PRIORITY.FORCE);
            } else if (debug.hold === name) {
                debug.hold = null;
            }
        },
        setOverride() { /* Live2D 由参数与动作驱动，不支持直接覆盖姿态参数 */ },
        // 视线跟随指针已整体移除：Cubism 自带的 drag 管理器会把 ParamAngleX/Y
        // 推到 ±30，头颈在 2D 投影下被明显压缩，与主控后端表现不一致，
        // 因此两个后端都不再响应指针。runtime.setDragging 仍保留为运行时能力。
        reset() {
            debug.action = null;
            debug.hold = null;
            debug.lowHp = false;
            runtime.playRandomIdle();
        },
        getDebugState() { return { running, frames: frameCount, ...debug }; },
        dispose() {
            this.stop();
            userModel.deleteRenderer?.();
            runtime.dispose();
        },
    };
}

/** 注册表用：hiyori 作为实验性技术验证模型，默认不出现在选择界面。 */
export const HiyoriReferenceModel = Object.freeze({
    id: "hiyori-ref",
    name: "LIVE2D · HIYORI",
    title: "CUBISM REFERENCE",
    description: "Live2D 官方示例模型 · 仅用于验证 Cubism 运行时接入，非出场角色",
    image: "assets/models/hiyori/hiyori_free_t08.2048/texture_00.png",
    backend: "live2d",
    modelDir: "assets/models/hiyori/",
    modelJson: "hiyori_free_t08.model3.json",
    experimental: true,
});
