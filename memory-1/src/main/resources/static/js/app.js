(function () {
    'use strict';

    var motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    var reducedMotion = motionQuery.matches;
    var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    function animateOnce(element, keyframes, options) {
        if (!element) {
            return null;
        }
        var finalFrame = keyframes[keyframes.length - 1] || {};
        if (reducedMotion || !element.animate) {
            if (typeof finalFrame.opacity !== 'undefined') {
                element.style.opacity = finalFrame.opacity;
            }
            if (typeof finalFrame.transform !== 'undefined') {
                element.style.transform = finalFrame.transform;
            }
            return null;
        }
        return element.animate(keyframes, Object.assign({
            duration: 600,
            easing: 'cubic-bezier(.16, 1, .3, 1)',
            fill: 'forwards'
        }, options || {}));
    }

    function animateDisclosure(target, open) {
        if (!target) {
            return;
        }
        if (target.__disclosureAnimation) {
            target.__disclosureAnimation.cancel();
            target.__disclosureAnimation = null;
        }

        if (open) {
            target.hidden = false;
            target.classList.remove('is-closing');
            target.classList.add('is-open');
            var opening = animateOnce(target, [
                { opacity: 0, transform: 'translateY(-8px)' },
                { opacity: 1, transform: 'translateY(0)' }
            ], { duration: 360 });
            if (opening) {
                target.__disclosureAnimation = opening;
                opening.onfinish = function () {
                    target.__disclosureAnimation = null;
                    target.style.removeProperty('opacity');
                    target.style.removeProperty('transform');
                };
            }
            return;
        }

        if (reducedMotion || !target.animate) {
            target.hidden = true;
            target.classList.remove('is-open', 'is-closing');
            return;
        }

        target.classList.add('is-closing');
        var closing = target.animate([
            { opacity: 1, transform: 'translateY(0)' },
            { opacity: 0, transform: 'translateY(-8px)' }
        ], {
            duration: 220,
            easing: 'cubic-bezier(.4, 0, 1, 1)',
            fill: 'forwards'
        });
        target.__disclosureAnimation = closing;
        closing.onfinish = function () {
            target.hidden = true;
            target.classList.remove('is-open', 'is-closing');
            target.style.removeProperty('opacity');
            target.style.removeProperty('transform');
            target.__disclosureAnimation = null;
        };
    }

    function initPanels() {
        document.querySelectorAll('[data-toggle-target]').forEach(function (button) {
            var target = document.getElementById(button.getAttribute('data-toggle-target'));
            if (!target) {
                return;
            }
            button.addEventListener('click', function () {
                var open = target.hidden;
                button.setAttribute('aria-expanded', String(open));
                var openLabel = button.getAttribute('data-open-label') || '收起';
                var closedLabel = button.getAttribute('data-closed-label') || button.textContent;
                button.textContent = open ? openLabel : closedLabel;
                animateDisclosure(target, open);
                if (open && !reducedMotion) {
                    window.setTimeout(function () {
                        target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }, 30);
                }
            });
        });
    }

    function initMobileNav() {
        var button = document.querySelector('[data-mobile-menu]');
        var panel = document.getElementById('mobileNavPanel');
        if (!button || !panel) {
            return;
        }
        button.addEventListener('click', function () {
            var open = panel.hidden;
            button.setAttribute('aria-expanded', String(open));
            button.textContent = open ? '收起菜单' : '菜单';
            animateDisclosure(panel, open);
        });
    }

    function initTheme() {
        var root = document.documentElement;
        var buttons = document.querySelectorAll('[data-theme-toggle]');
        var saved = window.localStorage.getItem('sekai-theme');
        if (saved === 'light' || saved === 'dark') {
            root.setAttribute('data-theme', saved);
        }
        function updateLabel() {
            var isLight = root.getAttribute('data-theme') === 'light';
            buttons.forEach(function (button) {
                button.textContent = isLight ? '深色' : '浅色';
                button.setAttribute('aria-label', isLight ? '切换到深色主题' : '切换到浅色主题');
            });
        }
        updateLabel();
        buttons.forEach(function (button) {
            button.addEventListener('click', function () {
                var next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
                root.setAttribute('data-theme', next);
                window.localStorage.setItem('sekai-theme', next);
                updateLabel();
            });
        });
    }

    var segmentMap = {
        '0': ['a', 'b', 'c', 'd', 'e', 'f'],
        '1': ['b', 'c'],
        '2': ['a', 'b', 'd', 'e', 'g'],
        '3': ['a', 'b', 'c', 'd', 'g'],
        '4': ['b', 'c', 'f', 'g'],
        '5': ['a', 'c', 'd', 'f', 'g'],
        '6': ['a', 'c', 'd', 'e', 'f', 'g'],
        '7': ['a', 'b', 'c'],
        '8': ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
        '9': ['a', 'b', 'c', 'd', 'f', 'g']
    };

    function makeDigit(value) {
        var digit = document.createElement('span');
        digit.className = 'segment-digit';
        digit.setAttribute('aria-hidden', 'true');
        ['a', 'b', 'c', 'd', 'e', 'f', 'g'].forEach(function (name) {
            var segment = document.createElement('span');
            segment.className = 'segment segment-' + name;
            if ((segmentMap[value] || []).indexOf(name) >= 0) {
                segment.className += ' on';
            }
            digit.appendChild(segment);
        });
        return digit;
    }

    function hydrateSegmentNumbers() {
        document.querySelectorAll('.segment-number').forEach(function (readout) {
            var value = readout.textContent.trim();
            if (!value || !/^[0-9]+$/.test(value)) {
                return;
            }
            readout.setAttribute('aria-label', value);
            readout.textContent = '';
            value.split('').forEach(function (digit) {
                readout.appendChild(makeDigit(digit));
            });
        });
    }

    function initSegmentMotion() {
        if (reducedMotion) {
            return;
        }
        document.querySelectorAll('.segment-number').forEach(function (readout) {
            readout.querySelectorAll('.segment-digit').forEach(function (digit, index) {
                animateOnce(digit, [
                    { opacity: 0, transform: 'translateY(5px)' },
                    { opacity: 1, transform: 'translateY(0)' }
                ], { duration: 420, delay: 160 + index * 48 });
            });
        });
    }

    function initReveals() {
        var elements = document.querySelectorAll(
            '.reveal, .page-head, .search-bar, .toolbar-row, .detail-card, .relation-grid, .pagination'
        );
        if (!elements.length) {
            return;
        }
        if (reducedMotion || !('IntersectionObserver' in window)) {
            elements.forEach(function (element) {
                element.classList.add('reveal');
                element.classList.remove('is-pending');
            });
            return;
        }
        elements.forEach(function (element) {
            element.classList.add('reveal');
            element.classList.add('is-pending');
        });
        var observer = new IntersectionObserver(function (entries, currentObserver) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) {
                    return;
                }
                var element = entry.target;
                var animation = animateOnce(element, [
                    { opacity: 0, transform: 'translateY(14px)' },
                    { opacity: 1, transform: 'translateY(0)' }
                ], { delay: Number(element.getAttribute('data-reveal-delay') || 0) });
                if (animation) {
                    animation.onfinish = function () {
                        element.classList.remove('is-pending');
                    };
                } else {
                    element.classList.remove('is-pending');
                }
                currentObserver.unobserve(element);
            });
        }, { threshold: .12, rootMargin: '0px 0px -8% 0px' });
        elements.forEach(function (element) {
            observer.observe(element);
        });
    }

    function initHero() {
        if (reducedMotion) {
            return;
        }
        var title = document.querySelector('.hero-copy h1');
        var intro = document.querySelector('.hero-copy p');
        var actions = document.querySelector('.hero-copy .action-row');
        var visual = document.querySelector('.hero-visual');
        var metrics = document.querySelectorAll('.metric-cell');
        animateOnce(title, [
            { opacity: 0, transform: 'translateY(18px)' },
            { opacity: 1, transform: 'translateY(0)' }
        ], { duration: 760, delay: 100 });
        animateOnce(intro, [
            { opacity: 0, transform: 'translateY(14px)' },
            { opacity: 1, transform: 'translateY(0)' }
        ], { duration: 640, delay: 260 });
        animateOnce(actions, [
            { opacity: 0, transform: 'translateY(12px)' },
            { opacity: 1, transform: 'translateY(0)' }
        ], { duration: 560, delay: 360 });
        animateOnce(visual, [
            { opacity: .4, transform: 'translateY(10px)' },
            { opacity: 1, transform: 'translateY(0)' }
        ], { duration: 900, delay: 180 });
        metrics.forEach(function (metric, index) {
            animateOnce(metric, [
                { opacity: 0, transform: 'translateY(10px)' },
                { opacity: 1, transform: 'translateY(0)' }
            ], { duration: 500, delay: 220 + index * 70 });
        });
    }

    function initHeroParallax() {
        var visual = document.querySelector('.hero-visual');
        if (!visual || reducedMotion || !finePointer) {
            return;
        }
        var bounds;
        var framePending = false;
        var x = 0;
        var y = 0;

        function render() {
            framePending = false;
            visual.style.setProperty('--parallax-x', (-x * 12).toFixed(2) + 'px');
            visual.style.setProperty('--parallax-y', (-y * 12).toFixed(2) + 'px');
        }

        visual.addEventListener('pointerenter', function () {
            bounds = visual.getBoundingClientRect();
        });
        visual.addEventListener('pointermove', function (event) {
            bounds = bounds || visual.getBoundingClientRect();
            x = (event.clientX - bounds.left) / bounds.width - .5;
            y = (event.clientY - bounds.top) / bounds.height - .5;
            if (!framePending) {
                framePending = true;
                window.requestAnimationFrame(render);
            }
        });
        visual.addEventListener('pointerleave', function () {
            bounds = null;
            visual.style.removeProperty('--parallax-x');
            visual.style.removeProperty('--parallax-y');
        });
    }

    function initCardTilt() {
        if (reducedMotion || !finePointer) {
            return;
        }
        document.querySelectorAll('.series-card, .character-card, .archive-card').forEach(function (card) {
            var bounds;
            card.classList.add('card-tilt-ready');
            card.addEventListener('pointerenter', function () {
                bounds = card.getBoundingClientRect();
                card.classList.add('is-tilting');
            });
            card.addEventListener('pointermove', function (event) {
                bounds = bounds || card.getBoundingClientRect();
                var localX = (event.clientX - bounds.left) / bounds.width - .5;
                var localY = (event.clientY - bounds.top) / bounds.height - .5;
                card.style.setProperty('--tilt-x', (localY * -3.5).toFixed(2) + 'deg');
                card.style.setProperty('--tilt-y', (localX * 3.5).toFixed(2) + 'deg');
            });
            card.addEventListener('pointerleave', function () {
                bounds = null;
                card.classList.remove('is-tilting');
                card.style.removeProperty('--tilt-x');
                card.style.removeProperty('--tilt-y');
            });
        });
    }

    function initAudioState() {
        document.querySelectorAll('.quote-audio, .mini-audio').forEach(function (audio) {
            var item = audio.closest('.quote-item');
            if (!item) {
                return;
            }
            audio.addEventListener('play', function () {
                item.classList.add('is-playing');
            });
            audio.addEventListener('pause', function () {
                item.classList.remove('is-playing');
            });
            audio.addEventListener('ended', function () {
                item.classList.remove('is-playing');
            });
        });
    }

    function initSubmitFeedback() {
        document.querySelectorAll('form:not(#loginForm):not(#registerForm)').forEach(function (form) {
            form.addEventListener('submit', function () {
                if (form.dataset.motionSubmitted === 'true' || (form.checkValidity && !form.checkValidity())) {
                    return;
                }
                var button = form.querySelector('button[type="submit"]');
                if (!button || button.classList.contains('danger')) {
                    return;
                }
                form.dataset.motionSubmitted = 'true';
                button.disabled = true;
                button.setAttribute('aria-busy', 'true');
                button.dataset.originalLabel = button.textContent;
                button.textContent = form.getAttribute('role') === 'search' ? '检索中' : '提交中';
            });
        });
    }

    function initAuthMotion() {
        if (reducedMotion) {
            return;
        }
        animateOnce(document.querySelector('.brand-area'), [
            { opacity: 0, transform: 'translateX(-18px)' },
            { opacity: 1, transform: 'translateX(0)' }
        ], { duration: 820 });
        animateOnce(document.querySelector('.form-area'), [
            { opacity: 0, transform: 'translateX(18px)' },
            { opacity: 1, transform: 'translateX(0)' }
        ], { duration: 720, delay: 100 });
        animateOnce(document.querySelector('.login-card'), [
            { opacity: 0, transform: 'translateY(12px)' },
            { opacity: 1, transform: 'translateY(0)' }
        ], { duration: 620, delay: 220 });
        document.querySelectorAll('.brand-records span, .form-group').forEach(function (element, index) {
            animateOnce(element, [
                { opacity: 0, transform: 'translateY(8px)' },
                { opacity: 1, transform: 'translateY(0)' }
            ], { duration: 420, delay: 320 + index * 55 });
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        initTheme();
        initPanels();
        initMobileNav();
        hydrateSegmentNumbers();
        initSegmentMotion();
        initReveals();
        initHero();
        initHeroParallax();
        initCardTilt();
        initAudioState();
        initSubmitFeedback();
        initAuthMotion();
    });
}());
