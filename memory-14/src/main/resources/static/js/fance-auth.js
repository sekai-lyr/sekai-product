(function () {
  var page = document.querySelector('.auth-page');
  if (!page) return;

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(pointer: fine)').matches;
  var menuButton = document.querySelector('.menu-toggle');
  var siteNav = document.getElementById('siteNav');
  var accessLayer = document.getElementById('accessLayer');
  var accessCard = document.getElementById('access');
  var accessTriggers = document.querySelectorAll('[aria-controls="accessLayer"]');
  var closeAccessButton = document.querySelector('.access-close');
  var lastFocusedElement = null;

  function syncAccessButtons(isOpen) {
    accessTriggers.forEach(function (trigger) {
      trigger.setAttribute('aria-expanded', String(isOpen));
    });
  }

  function openAccess() {
    if (!accessLayer || !accessCard) return;
    lastFocusedElement = document.activeElement;
    accessLayer.hidden = false;
    accessCard.setAttribute('aria-hidden', 'false');
    syncAccessButtons(true);
    document.body.classList.add('access-open');
    window.requestAnimationFrame(function () {
      accessLayer.classList.add('open');
    });
    window.setTimeout(function () {
      var firstField = accessCard.querySelector('input');
      if (firstField) firstField.focus();
    }, reducedMotion ? 0 : 240);
  }

  function closeAccess() {
    if (!accessLayer || accessLayer.hidden) return;
    accessLayer.classList.remove('open');
    accessCard.setAttribute('aria-hidden', 'true');
    syncAccessButtons(false);
    document.body.classList.remove('access-open');
    window.setTimeout(function () {
      accessLayer.hidden = true;
      if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
        lastFocusedElement.focus();
      }
    }, reducedMotion ? 0 : 360);
  }

  accessTriggers.forEach(function (trigger) {
    trigger.addEventListener('click', openAccess);
  });

  if (closeAccessButton) closeAccessButton.addEventListener('click', closeAccess);
  if (accessLayer) {
    accessLayer.addEventListener('click', function (event) {
      if (event.target.matches('[data-close-access="true"]')) closeAccess();
    });
  }

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') closeAccess();
  });

  if (menuButton && siteNav) {
    menuButton.addEventListener('click', function () {
      var isOpen = siteNav.classList.toggle('open');
      menuButton.setAttribute('aria-expanded', String(isOpen));
      menuButton.textContent = isOpen ? 'Close' : 'Menu';
    });

    siteNav.addEventListener('click', function (event) {
      if (!event.target.closest('a')) return;
      siteNav.classList.remove('open');
      menuButton.setAttribute('aria-expanded', 'false');
      menuButton.textContent = 'Menu';
    });
  }

  var passwordToggle = document.querySelector('.password-toggle');
  if (passwordToggle) {
    passwordToggle.addEventListener('click', function () {
      var password = document.getElementById('pw');
      var revealed = password.type === 'password';
      password.type = revealed ? 'text' : 'password';
      passwordToggle.classList.toggle('revealed', revealed);
      passwordToggle.setAttribute('aria-pressed', String(revealed));
      passwordToggle.setAttribute('aria-label', revealed ? 'Hide password' : 'Show password');
    });
  }

  var backdrop = document.querySelector('.scene-backdrop');
  var skySprite = document.querySelector('.sky-sprite');
  var rippleLayer = document.querySelector('.pool-ripples');
  var lastRippleAt = 0;
  var framePending = false;
  var pointerX = 0;
  var pointerY = 0;

  if (skySprite && !reducedMotion && finePointer) {
    document.documentElement.style.setProperty('--sprite-x', window.innerWidth * 0.82 + 'px');
    document.documentElement.style.setProperty('--sprite-y', window.innerHeight * 0.22 + 'px');
    window.setTimeout(function () {
      skySprite.classList.add('is-visible');
    }, 500);
  }

  function renderPointer() {
    framePending = false;
    if (backdrop) {
      backdrop.style.setProperty('--parallax-x', ((pointerX / window.innerWidth) - 0.5) * -12 + 'px');
      backdrop.style.setProperty('--parallax-y', ((pointerY / window.innerHeight) - 0.5) * -8 + 'px');
    }
    if (skySprite) {
      document.documentElement.style.setProperty('--sprite-x', pointerX + 'px');
      document.documentElement.style.setProperty('--sprite-y', pointerY + 'px');
      skySprite.classList.add('is-visible');
    }
  }

  function addRipple(event) {
    if (!rippleLayer || event.clientY < window.innerHeight * 0.58) return;
    if (event.target.closest('a, button, input, label, nav, form')) return;

    var now = Date.now();
    if (now - lastRippleAt < 150) return;
    lastRippleAt = now;

    var ripple = document.createElement('span');
    ripple.className = 'pool-ripple';
    ripple.style.left = event.clientX + 'px';
    ripple.style.top = event.clientY + 'px';
    rippleLayer.appendChild(ripple);
    window.setTimeout(function () {
      ripple.remove();
    }, 1300);
  }

  if (!reducedMotion && finePointer) {
    page.addEventListener('pointermove', function (event) {
      pointerX = event.clientX;
      pointerY = event.clientY;
      if (!framePending) {
        framePending = true;
        window.requestAnimationFrame(renderPointer);
      }
      addRipple(event);
    }, { passive: true });

    page.addEventListener('pointerleave', function () {
      if (skySprite) skySprite.classList.remove('is-visible');
    });
  }

  var form = document.querySelector('.auth-form');
  if (!form) return;

  var submitButton = form.querySelector('.submit-button');
  var message = document.getElementById('serverMsg');
  var pageType = page.getAttribute('data-page');

  function showMessage(text, type) {
    message.textContent = text;
    message.className = 'form-message show ' + type;
    message.hidden = false;
  }

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (form.getAttribute('aria-busy') === 'true') return;

    var isRegister = pageType === 'register';
    var endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
    var payload = {
      userName: document.getElementById('userName').value,
      password: document.getElementById('pw').value
    };

    if (isRegister) {
      payload.email = document.getElementById('email').value;
    }

    form.setAttribute('aria-busy', 'true');
    submitButton.disabled = true;
    submitButton.textContent = isRegister ? 'Creating your stay' : 'Opening your stay';
    message.hidden = true;
    message.className = 'form-message';

    try {
      var response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      var data = await response.json();

      if (data.code === 200) {
        showMessage(isRegister ? 'Your space is ready. Taking you inside.' : 'Welcome back. Taking you inside.', 'success');
        window.setTimeout(function () {
          window.location.href = '/chat';
        }, reducedMotion ? 100 : 650);
      } else {
        showMessage(data.message || (isRegister ? 'We could not create your account.' : 'We could not sign you in.'), 'error');
        form.setAttribute('aria-busy', 'false');
        submitButton.disabled = false;
        submitButton.textContent = isRegister ? 'Create account' : 'Enter FANCE';
      }
    } catch (error) {
      showMessage('The space is momentarily unavailable. Please try again.', 'error');
      form.setAttribute('aria-busy', 'false');
      submitButton.disabled = false;
      submitButton.textContent = isRegister ? 'Create account' : 'Enter FANCE';
    }
  });
})();
