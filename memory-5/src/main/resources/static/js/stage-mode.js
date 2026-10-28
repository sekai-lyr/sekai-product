(() => {
    "use strict";

    const root = document.querySelector("[data-stage-view-switcher]");
    if (!root) {
        return;
    }
    const toggle = root.querySelector("[data-stage-view-toggle]");
    const menu = root.querySelector("[data-stage-view-menu]");
    const label = root.querySelector("[data-stage-view-label]");
    const requestedMode = new URLSearchParams(window.location.search).get("mode");
    const modes = ["disc", "lyrics", "folia-classic", "folia"];
    const currentMode = modes.includes(requestedMode) ? requestedMode : "disc";

    function setOpen(open) {
        if (!toggle || !menu) {
            return;
        }
        menu.hidden = !open;
        toggle.setAttribute("aria-expanded", String(open));
        root.classList.toggle("is-open", open);
    }

    if (label) {
        label.textContent = currentMode === "folia"
            ? "Folia 最新"
            : (currentMode === "folia-classic"
                ? "Folia 经典"
                : (currentMode === "lyrics" ? "字阵舞台" : "唱片舞台"));
    }
    toggle?.addEventListener("click", (event) => {
        event.stopPropagation();
        setOpen(menu?.hidden !== false);
    });
    root.querySelectorAll("[data-stage-view-option]").forEach((option) => {
        option.addEventListener("click", (event) => {
            event.preventDefault();
            const url = new URL(window.location.href);
            const mode = modes.includes(option.dataset.stageViewOption)
                ? option.dataset.stageViewOption
                : "disc";
            if (mode === "disc") {
                url.searchParams.delete("mode");
            } else {
                url.searchParams.set("mode", mode);
            }
            window.location.href = url.toString();
        });
    });
    document.addEventListener("click", (event) => {
        if (!root.contains(event.target)) {
            setOpen(false);
        }
    });
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            setOpen(false);
        }
    });
})();
