(() => {
    "use strict";

    document.querySelectorAll("[data-confirm]").forEach((button) => {
        button.addEventListener("click", (event) => {
            if (!window.confirm(button.dataset.confirm)) event.preventDefault();
        });
    });

    // Only restore position after a gallery mutation, never when opening a different filter.
    const positionKey = "sekai-picture-return-position";
    document.querySelectorAll('form input[name="returnTo"]').forEach((input) => {
        input.form.addEventListener("submit", () => {
            try { sessionStorage.setItem(positionKey, JSON.stringify({ url: input.value, y: window.scrollY })); }
            catch (_) { /* Browsing remains available without session storage. */ }
        });
    });
    try {
        const saved = JSON.parse(sessionStorage.getItem(positionKey) || "null");
        sessionStorage.removeItem(positionKey);
        if (saved && location.pathname === "/home") {
            const normalize = (url) => {
                const parsed = new URL(url, location.origin);
                parsed.searchParams.sort();
                return parsed.pathname + parsed.search;
            };
            if (normalize(saved.url) === normalize(location.href)) requestAnimationFrame(() => window.scrollTo(0, saved.y));
        }
    } catch (_) { /* An expired or malformed position does not affect the page. */ }

    document.querySelectorAll(".wallpaper-preview img, .rank-list img, .dashboard-art img").forEach((image) => {
        image.addEventListener("error", () => {
            image.src = "/images/image-unavailable.svg";
            image.alt = "图片暂时无法加载";
        }, { once: true });
    });

    const triggers = [...document.querySelectorAll("[data-lightbox-src]")];
    if (triggers.length) {
        const dialog = document.createElement("dialog");
        dialog.className = "gallery-preview";
        dialog.setAttribute("aria-labelledby", "previewTitle");
        dialog.innerHTML = '<header><h2 id="previewTitle"></h2><button type="button" data-close>关闭预览</button></header><p role="status" data-status></p><img alt=""><footer><a class="button-primary" data-download>下载原图</a></footer>';
        document.body.append(dialog);
        const image = dialog.querySelector("img");
        const status = dialog.querySelector("[data-status]");
        const download = dialog.querySelector("[data-download]");
        let opener;
        triggers.forEach((trigger) => trigger.addEventListener("click", (event) => {
            event.preventDefault();
            opener = trigger;
            dialog.querySelector("h2").textContent = trigger.dataset.lightboxAlt || "壁纸预览";
            image.alt = trigger.dataset.lightboxAlt || "壁纸预览";
            status.textContent = "正在加载原图…";
            image.hidden = true;
            image.onload = () => { image.hidden = false; status.textContent = ""; };
            image.onerror = () => { status.textContent = "原图暂时无法加载，请关闭后重试。"; };
            image.src = trigger.dataset.lightboxSrc;
            download.hidden = !trigger.dataset.lightboxDownload;
            if (trigger.dataset.lightboxDownload) download.href = trigger.dataset.lightboxDownload;
            else download.removeAttribute("href");
            dialog.showModal();
            document.body.classList.add("has-lightbox");
            dialog.querySelector("[data-close]").focus();
        }));
        dialog.querySelector("[data-close]").addEventListener("click", () => dialog.close());
        dialog.addEventListener("click", (event) => {
            const bounds = dialog.getBoundingClientRect();
            if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close();
        });
        dialog.addEventListener("keydown", (event) => {
            if (event.key !== "Tab") return;
            const focusable = [...dialog.querySelectorAll("button, a[href]")].filter((node) => !node.hidden);
            const first = focusable[0], last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        });
        dialog.addEventListener("close", () => {
            document.body.classList.remove("has-lightbox");
            opener?.focus();
        });
    }

    const form = document.querySelector("#uploadForm");
    if (!form) return;
    const input = form.querySelector('[type="file"]');
    const drop = form.querySelector(".file-drop");
    const title = form.querySelector('[name="title"]');
    const submit = form.querySelector('[type="submit"]');
    const queue = document.querySelector("#uploadQueue");
    const list = document.querySelector("#queueItems");
    const summary = document.querySelector("#queueStatus");
    const preview = document.querySelector("#filePreview");
    input.multiple = true;
    title.required = false;
    let files = [], items = [], busy = false, previewUrl;

    const select = (selected) => {
        if (busy) return;
        files = [...selected];
        submit.disabled = !files.length || files.length > 50;
        document.querySelector("#fileName").textContent = files.length > 50 ? "每批最多 50 张，请重新选择" : `已选择 ${files.length} 张；每张不超过 20 MB`;
        drop.classList.toggle("is-selected", files.length > 0);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        preview.hidden = !files.length;
        if (files.length) { previewUrl = URL.createObjectURL(files[0]); preview.src = previewUrl; }
        queue.hidden = true;
        submit.textContent = "开始上传";
    };
    input.addEventListener("change", () => select(input.files));
    for (const name of ["dragenter", "dragover"]) drop.addEventListener(name, (event) => {
        event.preventDefault();
        if (!busy) drop.classList.add("is-dragging");
    });
    drop.addEventListener("dragleave", () => drop.classList.remove("is-dragging"));
    drop.addEventListener("drop", (event) => {
        event.preventDefault(); drop.classList.remove("is-dragging");
        if (busy) return;
        // Files are kept in memory; submission does not depend on assigning FileList.
        select(event.dataTransfer.files);
        input.required = false;
    });
    const updateSummary = () => {
        const complete = items.filter((item) => item.success).length;
        const failed = items.filter((item) => item.failed).length;
        summary.textContent = `${complete} 张已保存，${failed} 张未完成，共 ${items.length} 张。${busy ? "正在上传…" : "未完成的图片可单独重试。"}`;
    };
    const lock = (value) => {
        busy = value;
        form.setAttribute("aria-busy", String(value));
        form.querySelectorAll("input, select, button").forEach((control) => { control.disabled = value; });
        items.forEach((item) => { item.retry.disabled = value; });
        updateSummary();
    };
    const send = (item, metadata) => new Promise((resolve) => {
        item.failed = false;
        item.retry.hidden = true;
        const body = new FormData();
        for (const [key, value] of metadata) if (key !== "file") body.append(key, value);
        const prefix = String(body.get("title") || "").trim();
        if (prefix && items.length > 1) body.set("title", `${prefix.slice(0, 110)} · ${items.indexOf(item) + 1}`);
        body.set("file", item.file);
        const fail = (message) => {
            item.failed = true; item.label.textContent = message; item.retry.hidden = false; resolve();
        };
        if (item.file.size > 20 * 1024 * 1024) { fail("超过 20 MB，请换一张图片"); return; }
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/wallpapers/upload");
        xhr.timeout = 120000;
        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) item.progress.value = Math.round(event.loaded * 100 / event.total);
            item.label.textContent = item.progress.value === 100 ? "正在校验并保存…" : `上传中 ${item.progress.value}%`;
        };
        xhr.onload = () => {
            let result;
            try { result = JSON.parse(xhr.responseText); } catch (_) { fail("服务暂时无法处理，请重试"); return; }
            if (xhr.status === 401) { fail("登录已过期，请在新页面登录后重试"); return; }
            if (!result.isSuccess) { fail(result.message || "上传失败，请重试"); return; }
            item.success = true;
            item.progress.value = 100;
            item.label.textContent = "已保存到图库";
            resolve();
        };
        xhr.onerror = () => fail("网络中断，请重试");
        xhr.ontimeout = () => fail("请求超时，请先查看图库或重试");
        xhr.send(body);
    });
    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (busy || !files.length || files.length > 50) return;
        const metadata = new FormData(form);
        list.replaceChildren();
        items = files.map((file) => {
            const row = document.createElement("li");
            const name = document.createElement("strong"); name.textContent = file.name;
            const progress = document.createElement("progress"); progress.max = 100; progress.value = 0; progress.setAttribute("aria-label", `${file.name} 上传进度`);
            const label = document.createElement("span"); label.textContent = "等待上传";
            const retry = document.createElement("button"); retry.type = "button"; retry.textContent = "重试"; retry.hidden = true;
            row.append(name, progress, label, retry); list.append(row);
            const item = { file, progress, label, retry, success: false, failed: false };
            retry.addEventListener("click", async () => {
                if (busy) return;
                const retryMetadata = new FormData(form);
                lock(true); await send(item, retryMetadata); lock(false); submit.disabled = true;
            });
            return item;
        });
        queue.hidden = false;
        lock(true);
        for (const item of items) { await send(item, metadata); updateSummary(); }
        lock(false);
        submit.disabled = true;
        submit.textContent = "选择新图片继续上传";
    });
    window.addEventListener("beforeunload", (event) => { if (busy) { event.preventDefault(); event.returnValue = ""; } });
    window.addEventListener("pagehide", () => { if (previewUrl) URL.revokeObjectURL(previewUrl); });
})();
