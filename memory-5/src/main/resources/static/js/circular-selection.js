(() => {
    "use strict";

    const roots = Array.from(document.querySelectorAll("[data-circular-selection]"));
    if (!roots.length) {
        return;
    }

    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const TO_RAD = Math.PI / 180;
    const DRAG_THRESHOLD = 6;
    const SPRING = 96;

    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    const wrap = (degrees) => ((((degrees + 180) % 360) + 360) % 360) - 180;

    function init(root) {
        const cards = Array.from(root.children).filter((node) => node.classList.contains("selection-track"));
        const anchors = cards.map((card) => card.querySelector(".selection-track-select")).filter(Boolean);
        if (!cards.length || !anchors.length) {
            return;
        }

        const count = cards.length;
        const state = {
            angle: 0,
            velocity: 0,
            target: null,
            dragging: false,
            hover: false,
            press: null,
            suppressClick: false,
            active: -1,
            last: 0,
            raf: 0,
            wheelTimer: 0,
            radius: 520,
            step: 360 / count
        };

        root.classList.add("circular-selection");
        root.setAttribute("role", "region");
        root.setAttribute("aria-roledescription", "carousel");
        root.setAttribute("aria-label", root.dataset.circularSelectionLabel || "选择项目");
        root.tabIndex = 0;

        const caption = document.createElement("div");
        caption.className = "circular-selection-caption";
        caption.innerHTML = '<strong></strong><span></span><em></em>';
        root.appendChild(caption);
        const captionTitle = caption.querySelector("strong");
        const captionSub = caption.querySelector("span");
        const captionCount = caption.querySelector("em");

        function titleFor(index) {
            const anchor = anchors[index];
            return anchor?.dataset.name || anchor?.dataset.title || anchor?.querySelector("strong")?.textContent?.trim() || "未命名项目";
        }

        function subtitleFor(index) {
            const anchor = anchors[index];
            return anchor?.querySelector(".selection-track-copy small")?.textContent?.trim()
                || [anchor?.dataset.artist, anchor?.dataset.anime, anchor?.dataset.album].filter(Boolean).join(" · ");
        }

        function activeIndex() {
            return ((Math.round(-state.angle / state.step) % count) + count) % count;
        }

        function updateCaption(index) {
            captionTitle.textContent = titleFor(index);
            captionSub.textContent = subtitleFor(index);
            captionCount.textContent = `${String(index + 1).padStart(2, "0")} / ${String(count).padStart(2, "0")}`;
        }

        function announce(index) {
            if (index === state.active) {
                return;
            }
            state.active = index;
            cards.forEach((card, cardIndex) => {
                const selected = cardIndex === index;
                card.classList.toggle("is-active", selected);
                anchors[cardIndex].setAttribute("aria-current", selected ? "true" : "false");
            });
            updateCaption(index);
            root.dispatchEvent(new CustomEvent("circular-selection-change", {
                detail: { button: anchors[index], card: cards[index], index }
            }));
        }

        function measure() {
            const rect = root.getBoundingClientRect();
            if (!rect.width || !rect.height) {
                return;
            }
            const isMobile = rect.width < 900;
            let cardWidth = isMobile
                ? clamp(rect.width * 0.78, 260, 330)
                : clamp(rect.width * 0.24, 335, 400);
            let cardHeight = isMobile
                ? clamp(rect.height * 0.48, 300, 370)
                : clamp(rect.height * 0.44, 300, 380);
            if (root.classList.contains("playlist-index-list")) {
                // Compensate for the foreground perspective so the playlist stays compact.
                cardWidth = Math.min(clamp(rect.width * 0.24, 300, 400), Math.max(265, rect.height * 0.67));
                cardHeight = cardWidth * 1.65;
            }
            const pitch = cardWidth + 34;
            const calculatedRadius = pitch / (2 * Math.sin(Math.PI / Math.max(count, 3)));
            state.radius = clamp(calculatedRadius, 270, Math.min(760, Math.max(360, rect.width * 0.78)));
            state.step = 360 / count;
            root.style.setProperty("--circular-card-width", `${Math.round(cardWidth)}px`);
            root.style.setProperty("--circular-card-height", `${Math.round(cardHeight)}px`);
            root.style.setProperty("--circular-radius", `${Math.round(state.radius)}px`);
        }

        function targetFor(index) {
            let target = -index * state.step;
            target += 360 * Math.round((state.angle - target) / 360);
            return target;
        }

        function focusIndex(index) {
            state.target = targetFor((index + count) % count);
            state.velocity = 0;
            wake();
        }

        function render() {
            const current = activeIndex();
            cards.forEach((card, index) => {
                const world = wrap(index * state.step + state.angle);
                const facing = (Math.cos(world * TO_RAD) + 1) / 2;
                const depth = Math.pow(facing, 1.18);
                card.style.transform = `translate3d(-50%, -50%, ${-state.radius - 160}px) rotateY(${index * state.step + state.angle}deg) translateZ(${state.radius}px)`;
                card.style.opacity = (0.14 + depth * 0.86).toFixed(3);
                card.style.filter = `saturate(${(0.62 + depth * 0.38).toFixed(3)}) brightness(${(0.64 + depth * 0.36).toFixed(3)})`;
                card.style.zIndex = String(Math.round(depth * 1000));
                card.style.setProperty("--circular-depth", depth.toFixed(3));
            });
            announce(current);
        }

        function animate(now) {
            state.raf = 0;
            const dt = state.last ? Math.min((now - state.last) / 1000, 0.05) : 1 / 60;
            state.last = now;

            if (state.dragging) {
                render();
                state.raf = requestAnimationFrame(animate);
                return;
            }

            if (state.target !== null) {
                const damping = 2 * Math.sqrt(SPRING);
                state.velocity += (state.target - state.angle) * SPRING * dt - state.velocity * damping * dt;
                state.angle += state.velocity * dt;
                if (Math.abs(state.target - state.angle) < 0.03 && Math.abs(state.velocity) < 0.15) {
                    state.angle = state.target;
                    state.velocity = 0;
                    state.target = null;
                }
            } else if (!reducedMotion && !state.hover) {
                const cruise = -6;
                state.velocity += (cruise - state.velocity) * (1 - Math.exp(-dt / 0.65));
                state.angle += state.velocity * dt;
            } else if (Math.abs(state.velocity) > 0.01) {
                state.velocity *= Math.exp(-dt * 6);
                state.angle += state.velocity * dt;
            }

            render();
            if (!document.hidden && (state.target !== null || state.dragging || (!reducedMotion && !state.hover) || Math.abs(state.velocity) > 0.01)) {
                state.raf = requestAnimationFrame(animate);
            } else {
                state.last = 0;
            }
        }

        function wake() {
            if (!state.raf && !document.hidden) {
                state.raf = requestAnimationFrame(animate);
            }
        }

        root.addEventListener("pointerdown", (event) => {
            if (event.pointerType === "mouse" && event.button !== 0) {
                return;
            }
            state.press = {
                id: event.pointerId,
                x: event.clientX,
                y: event.clientY,
                angle: state.angle,
                moved: false,
                samples: [{ time: performance.now(), angle: state.angle }]
            };
            state.suppressClick = false;
            root.classList.add("is-pressed");
        });

        root.addEventListener("pointermove", (event) => {
            const press = state.press;
            if (!press || press.id !== event.pointerId) {
                return;
            }
            const deltaX = event.clientX - press.x;
            const deltaY = event.clientY - press.y;
            if (!press.moved) {
                if (Math.abs(deltaX) < DRAG_THRESHOLD) {
                    return;
                }
                if (event.pointerType !== "mouse" && Math.abs(deltaY) > Math.abs(deltaX) * 1.2) {
                    state.press = null;
                    return;
                }
                press.moved = true;
                state.dragging = true;
                state.target = null;
                try {
                    root.setPointerCapture(event.pointerId);
                } catch (error) {
                    // Pointer capture is an enhancement; dragging still works without it.
                }
            }
            const perPixel = 180 / (Math.PI * state.radius);
            state.angle = press.angle + deltaX * perPixel;
            const now = performance.now();
            press.samples.push({ time: now, angle: state.angle });
            while (press.samples.length > 2 && now - press.samples[0].time > 120) {
                press.samples.shift();
            }
            event.preventDefault();
            wake();
        }, { passive: false });

        const release = (event) => {
            const press = state.press;
            if (!press || press.id !== event.pointerId) {
                return;
            }
            state.press = null;
            root.classList.remove("is-pressed");
            if (!press.moved) {
                return;
            }
            state.dragging = false;
            state.suppressClick = true;
            try {
                root.releasePointerCapture(event.pointerId);
            } catch (error) {
                // The pointer may already have been released by the browser.
            }
            const first = press.samples[0];
            const last = press.samples[press.samples.length - 1];
            const seconds = Math.max((last.time - first.time) / 1000, 0.01);
            state.velocity = clamp((last.angle - first.angle) / seconds, -720, 720);
            state.target = targetFor(activeIndex());
            wake();
            window.setTimeout(() => {
                state.suppressClick = false;
            }, 0);
        };

        root.addEventListener("pointerup", release);
        root.addEventListener("pointercancel", release);
        root.addEventListener("pointerenter", () => {
            state.hover = true;
            root.classList.add("is-hovering");
            wake();
        });
        root.addEventListener("pointerleave", () => {
            state.hover = false;
            root.classList.remove("is-hovering");
            wake();
        });
        root.addEventListener("wheel", (event) => {
            const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
            if (!delta) {
                return;
            }
            event.preventDefault();
            state.target = null;
            state.angle -= delta * (180 / (Math.PI * state.radius));
            state.velocity = -delta * 0.8;
            clearTimeout(state.wheelTimer);
            state.wheelTimer = window.setTimeout(() => {
                state.target = targetFor(activeIndex());
                wake();
            }, 150);
            wake();
        }, { passive: false });
        root.addEventListener("click", (event) => {
            if (state.suppressClick) {
                event.preventDefault();
                event.stopPropagation();
                state.suppressClick = false;
                return;
            }
            const card = event.target.closest?.(".selection-track");
            const index = card ? cards.indexOf(card) : -1;
            if (index >= 0) {
                focusIndex(index);
            }
        });
        root.addEventListener("keydown", (event) => {
            if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                focusIndex(activeIndex() - 1);
                event.preventDefault();
            } else if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                focusIndex(activeIndex() + 1);
                event.preventDefault();
            } else if (event.key === "Enter") {
                anchors[activeIndex()].click();
                event.preventDefault();
            }
        });

        const resize = new ResizeObserver(measure);
        resize.observe(root);
        document.addEventListener("visibilitychange", () => {
            if (document.hidden) {
                cancelAnimationFrame(state.raf);
                state.raf = 0;
                state.last = 0;
            } else {
                wake();
            }
        });

        measure();
        render();
        wake();
    }

    roots.forEach(init);
})();
