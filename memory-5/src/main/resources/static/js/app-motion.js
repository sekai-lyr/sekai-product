(() => {
    "use strict";

    const root = document.documentElement;
    const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const revealSelectors = [
        ".content > .section-title",
        ".content > .hero-panel",
        ".content > .stats-grid",
        ".content > .home-tools-grid",
        ".content > .two-column",
        ".content > .editor-panel",
        ".content > .card-grid",
        ".content > .pager",
        ".content > .search-bar",
        ".content > .playlist-hero",
        ".content > .lyrics-panel",
        ".content > .queue-panel",
        ".content > .message",
        ".content > .server-message"
    ];
    const itemContainerSelectors = [
        ".card-grid",
        ".song-list",
        ".compact-list",
        ".home-action-list",
        ".queue-list",
        ".bookmark-list",
        ".history-list"
    ];
    const pointerGlowSelectors = [
        ".home-tool-panel",
        ".song-card",
        ".playlist-card",
        ".stats-grid article",
        ".editor-panel"
    ];

    root.classList.add("js-motion");

    const revealTargets = new Set();
    revealSelectors.forEach((selector) => {
        document.querySelectorAll(selector).forEach((element) => revealTargets.add(element));
    });

    itemContainerSelectors.forEach((selector) => {
        document.querySelectorAll(selector).forEach((container) => {
            Array.from(container.children)
                .filter((element) => !element.classList.contains("empty") && !element.classList.contains("header"))
                .forEach((element, index) => {
                    element.classList.add("motion-item");
                    element.style.setProperty("--motion-delay", `${Math.min(index * 55, 385)}ms`);
                    revealTargets.add(element);
                });
        });
    });

    revealTargets.forEach((element) => element.classList.add("motion-reveal"));

    const revealImmediately = () => {
        revealTargets.forEach((element) => element.classList.add("is-visible"));
    };

    if (reduceMotionQuery.matches || !("IntersectionObserver" in window)) {
        revealImmediately();
    } else {
        // threshold 必须为 0：长列表容器（收藏卡片网格、首页双栏）在手机上可以
        // 高达上万像素，永远到不了 10% 的交叉比例，整块内容会一直停在 opacity:0。
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) {
                    return;
                }
                entry.target.classList.add("is-visible");
                observer.unobserve(entry.target);
            });
        }, {threshold: 0, rootMargin: "0px 0px -8% 0px"});

        revealTargets.forEach((element) => observer.observe(element));
    }

    // 指针光晕只在鼠标设备上启用：触屏没有 hover，pointermove 只会造成无意义的
    // 每帧 getBoundingClientRect 回流（拖动滚动时尤其明显）。
    const finePointerQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
    const pointerTargets = finePointerQuery.matches
        ? document.querySelectorAll(pointerGlowSelectors.join(","))
        : [];
    pointerTargets.forEach((element) => {
        element.classList.add("pointer-glow");
        element.addEventListener("pointermove", (event) => {
            const bounds = element.getBoundingClientRect();
            const x = ((event.clientX - bounds.left) / bounds.width) * 100;
            const y = ((event.clientY - bounds.top) / bounds.height) * 100;
            element.style.setProperty("--pointer-x", `${Math.max(0, Math.min(100, x))}%`);
            element.style.setProperty("--pointer-y", `${Math.max(0, Math.min(100, y))}%`);
        });
        element.addEventListener("pointerleave", () => {
            element.style.setProperty("--pointer-x", "50%");
            element.style.setProperty("--pointer-y", "0%");
        });
    });

    const pressedAnimations = new WeakMap();
    document.addEventListener("pointerdown", (event) => {
        if (reduceMotionQuery.matches || !(event.target instanceof Element)) {
            return;
        }
        const target = event.target.closest(
            "button, .pill-btn, .hero-action, .playlist-edit-link, .file-picker-button, .text-action"
        );
        if (!target || target.hasAttribute("disabled")) {
            return;
        }
        pressedAnimations.get(target)?.cancel();
        const animation = target.animate([
            {transform: "scale(1)"},
            {transform: "scale(.975)", offset: 0.45},
            {transform: "scale(1)"}
        ], {
            duration: 260,
            easing: "cubic-bezier(.2,.8,.2,1)"
        });
        pressedAnimations.set(target, animation);
    });

    const animateStats = () => {
        if (reduceMotionQuery.matches) {
            return;
        }
        document.querySelectorAll(".stats-grid article > span").forEach((element) => {
            const value = element.textContent.trim();
            if (!/^\d+$/.test(value)) {
                return;
            }
            const target = Number(value);
            if (!Number.isSafeInteger(target) || target <= 0) {
                return;
            }
            const startedAt = performance.now();
            const duration = 720;
            const tick = (now) => {
                const progress = Math.min(1, (now - startedAt) / duration);
                const eased = 1 - Math.pow(1 - progress, 3);
                element.textContent = String(Math.round(target * eased));
                if (progress < 1) {
                    window.requestAnimationFrame(tick);
                }
            };
            element.textContent = "0";
            window.requestAnimationFrame(tick);
        });
    };

    // 手机端导航：≤980px 时侧栏变成顶栏，导航项折叠进 .sidebar-panel。
    const navToggle = document.querySelector("[data-sidebar-toggle]");
    const sidebarRoot = navToggle ? navToggle.closest(".sidebar") : null;
    const mobileLayoutQuery = window.matchMedia("(max-width: 980px)");
    if (navToggle && sidebarRoot) {
        const panel = sidebarRoot.querySelector("[data-sidebar-panel]");
        const scrim = sidebarRoot.querySelector("[data-sidebar-scrim]");
        const desktopQuery = window.matchMedia("(min-width: 981px)");
        const isOpen = () => sidebarRoot.classList.contains("nav-open");
        const setOpen = (open) => {
            sidebarRoot.classList.toggle("nav-open", open);
            navToggle.setAttribute("aria-expanded", open ? "true" : "false");
            navToggle.setAttribute("aria-label", open ? "关闭导航菜单" : "打开导航菜单");
            if (scrim) {
                scrim.hidden = !open;
            }
            document.body.classList.toggle("nav-scroll-lock", open);
        };
        navToggle.addEventListener("click", () => setOpen(!isOpen()));
        scrim?.addEventListener("click", () => setOpen(false));
        panel?.addEventListener("click", (event) => {
            if (event.target instanceof Element && event.target.closest("a")) {
                setOpen(false);
            }
        });
        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && isOpen()) {
                setOpen(false);
                navToggle.focus();
            }
        });
        const syncToViewport = (event) => {
            if (event.matches) {
                setOpen(false);
            }
        };
        if (desktopQuery.addEventListener) {
            desktopQuery.addEventListener("change", syncToViewport);
        }
        setOpen(false);
    }

    // 把手机顶栏的真实高度写进 CSS 变量，供播放页舞台 / 歌曲库舞台计算可视高度。
    if (sidebarRoot) {
        const publishTopbarHeight = () => {
            if (mobileLayoutQuery.matches) {
                const height = Math.round(sidebarRoot.getBoundingClientRect().height);
                document.documentElement.style.setProperty("--sekai-topbar", height + "px");
            } else {
                document.documentElement.style.removeProperty("--sekai-topbar");
            }
        };
        publishTopbarHeight();
        window.addEventListener("resize", publishTopbarHeight);
        window.addEventListener("orientationchange", publishTopbarHeight);
        if ("ResizeObserver" in window) {
            new ResizeObserver(publishTopbarHeight).observe(sidebarRoot);
        }
    }

    const stage = document.querySelector(".player-stage");
    const audio = document.querySelector("audio.stage-audio");
    if (stage && audio) {
        const syncPlayingState = () => {
            stage.classList.toggle("is-playing", !audio.paused && !audio.ended);
        };
        ["play", "pause", "ended"].forEach((eventName) => audio.addEventListener(eventName, syncPlayingState));
        syncPlayingState();
    }

    window.requestAnimationFrame(animateStats);
})();
