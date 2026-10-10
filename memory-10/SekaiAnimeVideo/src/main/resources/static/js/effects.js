(function () {
    'use strict';

    // The project has no frontend package manager. Native WAAPI keeps the motion
    // layer small while following anime.js's WAAPI-first principles.
    var motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    var lastFocusedElement = null;

    function prefersReducedMotion() {
        return motionQuery.matches;
    }

    function play(element, keyframes, options) {
        if (!element || prefersReducedMotion() || !element.animate) return null;
        element.classList.add('is-entering');
        var animation = element.animate(keyframes, options);
        animation.addEventListener('finish', function () {
            element.classList.remove('is-entering');
        }, { once: true });
        return animation;
    }

    function revealPage() {
        var sequence = document.querySelectorAll(
            '.site-header, .hero-copy, .hero-media-wrap, .auth-visual-copy, .auth-card, ' +
            '.page-intro, .stat-rail, .dashboard-stats, .toolbar, .anime-sidebar, ' +
            '.anime-main, .hub-site-nav'
        );
        Array.prototype.forEach.call(sequence, function (element, index) {
            play(element, [
                { opacity: 0, transform: 'translateY(18px)' },
                { opacity: 1, transform: 'translateY(0)' }
            ], {
                duration: 620,
                delay: Math.min(index * 70, 350),
                easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
                fill: 'both'
            });
        });
    }

    function revealOnView() {
        var elements = document.querySelectorAll('.reveal');
        if (!elements.length) return;

        if (prefersReducedMotion() || !('IntersectionObserver' in window)) return;

        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                play(entry.target, [
                    { opacity: 0, transform: 'translateY(16px)' },
                    { opacity: 1, transform: 'translateY(0)' }
                ], {
                    duration: 520,
                    easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
                    fill: 'both'
                });
                observer.unobserve(entry.target);
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

        Array.prototype.forEach.call(elements, function (element) {
            observer.observe(element);
        });
    }

    function animateStats() {
        if (prefersReducedMotion()) return;

        var stats = document.querySelectorAll('.stat-value, .dash-value, .sstat-value');
        Array.prototype.forEach.call(stats, function (element, index) {
            var rawValue = element.textContent.trim();
            if (!/^\d+$/.test(rawValue)) return;
            var target = Number(rawValue);
            if (!target) return;

            var start = performance.now() + index * 55;
            var duration = 760;
            element.textContent = '0';

            function tick(now) {
                if (prefersReducedMotion()) {
                    element.textContent = rawValue;
                    return;
                }
                if (now < start) {
                    window.requestAnimationFrame(tick);
                    return;
                }
                var progress = Math.min((now - start) / duration, 1);
                var eased = 1 - Math.pow(1 - progress, 3);
                element.textContent = Math.round(target * eased).toLocaleString('zh-CN');
                if (progress < 1) window.requestAnimationFrame(tick);
            }

            window.requestAnimationFrame(tick);
        });
    }

    function addSpotlightMotion() {
        var elements = document.querySelectorAll('.site-card, .hot-card, .feature-image, .dashboard-visual, .sidebar-section');
        Array.prototype.forEach.call(elements, function (element) {
            element.dataset.spotlight = 'true';

            element.addEventListener('pointermove', function (event) {
                if (event.pointerType === 'touch') return;
                var rect = element.getBoundingClientRect();
                if (!rect.width || !rect.height) return;
                element.style.setProperty('--spot-x', ((event.clientX - rect.left) / rect.width * 100) + '%');
                element.style.setProperty('--spot-y', ((event.clientY - rect.top) / rect.height * 100) + '%');
            });

            element.addEventListener('pointerleave', function () {
                element.style.removeProperty('--spot-x');
                element.style.removeProperty('--spot-y');
            });
        });
    }

    function addRippleFeedback() {
        document.addEventListener('click', function (event) {
            var target = event.target.closest(
                'button, .hero-btn, .card-btn, .page-btn, .site-nav a, .hub-site-nav a, .quick-site-pill'
            );
            if (!target || target.disabled || target.classList.contains('no-ripple')) return;

            var rect = target.getBoundingClientRect();
            var x = event.clientX ? event.clientX - rect.left : rect.width / 2;
            var y = event.clientY ? event.clientY - rect.top : rect.height / 2;
            var ripple = document.createElement('span');
            ripple.className = 'ripple';
            ripple.style.left = x + 'px';
            ripple.style.top = y + 'px';
            target.appendChild(ripple);

            var animation = play(ripple, [
                { opacity: 0.24, transform: 'translate(-50%, -50%) scale(0)' },
                { opacity: 0, transform: 'translate(-50%, -50%) scale(1)' }
            ], {
                duration: 420,
                easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
                fill: 'forwards'
            });

            if (!animation) {
                ripple.remove();
                return;
            }
            animation.addEventListener('finish', function () { ripple.remove(); }, { once: true });
        });
    }

    function dismissSuccessMessage() {
        document.querySelectorAll('.flash.success').forEach(function (flash) {
            window.setTimeout(function () {
                if (!flash.isConnected) return;
                var animation = play(flash, [
                    { opacity: 1, transform: 'translateY(0)' },
                    { opacity: 0, transform: 'translateY(-6px)' }
                ], {
                    duration: 240,
                    easing: 'ease-in',
                    fill: 'forwards'
                });
                if (animation) {
                    animation.addEventListener('finish', function () { flash.remove(); }, { once: true });
                } else if (prefersReducedMotion()) {
                    flash.remove();
                }
            }, 4200);
        });
    }

    function openModal(id) {
        var modal = document.getElementById(id);
        if (!modal) return;
        modal.classList.remove('is-closing');
        var content = modal.querySelector('.modal-content');
        if (content && content.getAnimations) {
            content.getAnimations().forEach(function (animation) { animation.cancel(); });
        }
        lastFocusedElement = document.activeElement;
        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden', 'false');
        var firstField = modal.querySelector('input, select, button');
        if (firstField) firstField.focus();
        play(content, [
            { opacity: 0, transform: 'translateY(14px) scale(0.98)' },
            { opacity: 1, transform: 'translateY(0) scale(1)' }
        ], {
            duration: 260,
            easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
            fill: 'both'
        });
    }

    function closeModal(modal) {
        if (!modal || (!modal.classList.contains('is-open') && !modal.classList.contains('is-closing'))) return;
        var content = modal.querySelector('.modal-content');
        var restoreTarget = lastFocusedElement;
        modal.classList.remove('is-open');
        modal.classList.add('is-closing');
        modal.setAttribute('aria-hidden', 'true');

        function finish() {
            modal.classList.remove('is-closing');
            if (restoreTarget && typeof restoreTarget.focus === 'function') restoreTarget.focus();
        }

        if (prefersReducedMotion() || !content || !content.animate) {
            finish();
            return;
        }

        var animation = content.animate([
            { opacity: 1, transform: 'translateY(0) scale(1)' },
            { opacity: 0, transform: 'translateY(8px) scale(0.98)' }
        ], {
            duration: 180,
            easing: 'cubic-bezier(0.4, 0, 1, 1)',
            fill: 'forwards'
        });
        animation.addEventListener('finish', finish, { once: true });
    }

    function showLayer(element) {
        if (!element) return;
        element.classList.remove('is-closing');
        element.style.display = 'flex';
        if (prefersReducedMotion()) {
            element.classList.add('is-open');
            return;
        }
        window.requestAnimationFrame(function () { element.classList.add('is-open'); });
    }

    function hideLayer(element, callback) {
        if (!element) return;
        element.classList.remove('is-open');
        element.classList.add('is-closing');
        var duration = prefersReducedMotion() ? 0 : 220;
        window.setTimeout(function () {
            if (element.classList.contains('is-open')) return;
            element.classList.remove('is-closing');
            element.style.display = 'none';
            if (callback) callback();
        }, duration);
    }

    window.openModal = openModal;
    window.closeModal = function (id) {
        closeModal(document.getElementById(id));
    };
    window.sekaiMotion = {
        prefersReducedMotion: prefersReducedMotion,
        showLayer: showLayer,
        hideLayer: hideLayer
    };

    document.addEventListener('click', function (event) {
        var modal = event.target.closest('.modal');
        if (modal && event.target === modal) closeModal(modal);
    });

    document.addEventListener('keydown', function (event) {
        if (event.key !== 'Escape') return;
        document.querySelectorAll('.modal.is-open').forEach(closeModal);
    });

    document.addEventListener('DOMContentLoaded', function () {
        revealPage();
        revealOnView();
        animateStats();
        addSpotlightMotion();
        addRippleFeedback();
        dismissSuccessMessage();
    });
})();
