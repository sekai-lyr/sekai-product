(function () {
  'use strict';

  var COLORS = { pink: '#ff72b8', purple: '#9b7bff', cyan: '#55d8ff', mint: '#79e6c5', sun: '#ffd76f' };
  var COLORS_ARRAY = [COLORS.pink, COLORS.purple, COLORS.cyan, COLORS.mint, COLORS.sun];

  function rand(min, max) { return Math.random() * (max - min) + min; }
  function randInt(min, max) { return Math.floor(rand(min, max + 1)); }

  // ===== 1. ENHANCED STARFIELD =====
  function initStarfield(canvas, opts) {
    opts = opts || {};
    var count = opts.count || 120;
    var ctx = canvas.getContext('2d');
    var w, h, particles = [], stars = [], shootingStars = [];

    function resize() {
      w = canvas.width = canvas.offsetWidth;
      h = canvas.height = canvas.offsetHeight;
    }

    function Star() {
      this.x = Math.random() * w;
      this.y = Math.random() * h;
      this.size = rand(0.3, 2.2);
      this.opacity = rand(0.15, 0.9);
      this.speed = rand(0.0002, 0.0015);
      this.phase = rand(0, Math.PI * 2);
      this.color = COLORS_ARRAY[randInt(0, COLORS_ARRAY.length - 1)];
      this.isColor = Math.random() < 0.15;
    }
    Star.prototype.update = function () { this.phase += this.speed; };
    Star.prototype.draw = function () {
      var alpha = this.opacity * (0.5 + 0.5 * Math.sin(this.phase));
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = this.isColor ? this.color : '#fff';
      ctx.globalAlpha = alpha;
      ctx.fill();
      if (this.isColor && this.size > 1.2) {
        ctx.globalAlpha = alpha * 0.2;
        var g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size * 4);
        g.addColorStop(0, this.color);
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * 4, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    for (var s = 0; s < 120; s++) stars.push(new Star());

    function Particle() {
      this.x = Math.random() * w;
      this.y = Math.random() * h;
      this.vx = rand(-0.5, 0.5);
      this.vy = rand(-0.5, 0.5);
      this.size = rand(1, 3.5);
      this.color = COLORS_ARRAY[randInt(0, COLORS_ARRAY.length - 1)];
      this.opacity = rand(0.2, 0.8);
      this.pulse = rand(0, Math.PI * 2);
    }
    Particle.prototype.update = function () {
      this.x += this.vx;
      this.y += this.vy;
      this.pulse += 0.03;
      if (this.x < -30) this.x = w + 30;
      if (this.x > w + 30) this.x = -30;
      if (this.y < -30) this.y = h + 30;
      if (this.y > h + 30) this.y = -30;
    };
    Particle.prototype.draw = function () {
      var alpha = this.opacity + Math.sin(this.pulse) * 0.2;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.globalAlpha = Math.max(0.05, Math.min(1, alpha));
      ctx.fill();
      ctx.globalAlpha = alpha * 0.1;
      var g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size * 3);
      g.addColorStop(0, this.color);
      g.addColorStop(1, 'transparent');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * 3, 0, Math.PI * 2);
      ctx.fill();
    };
    for (var i = 0; i < count; i++) particles.push(new Particle());

    function ShootingStar() {
      this.reset(true);
    }
    ShootingStar.prototype.reset = function (instant) {
      this.x = rand(0, w);
      this.y = rand(0, h * 0.4);
      this.len = rand(60, 180);
      this.speed = rand(6, 14);
      this.angle = rand(0.3, 0.8);
      this.opacity = rand(0.4, 0.8);
      this.life = 0;
      this.maxLife = rand(20, 40);
      this.active = instant || false;
      this.wait = rand(100, 400);
    };
    ShootingStar.prototype.update = function () {
      if (!this.active) {
        this.wait--;
        if (this.wait <= 0) this.active = true;
        return;
      }
      this.life++;
      this.x += this.speed;
      this.y += this.speed * this.angle;
      if (this.life > this.maxLife || this.x > w + 50 || this.y > h + 50) this.reset();
    };
    ShootingStar.prototype.draw = function () {
      if (!this.active) return;
      var alpha = this.opacity * (1 - this.life / this.maxLife);
      var g = ctx.createLinearGradient(this.x, this.y, this.x - this.len, this.y - this.len * this.angle);
      g.addColorStop(0, 'rgba(255,255,255,' + alpha + ')');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x - this.len, this.y - this.len * this.angle);
      ctx.strokeStyle = g;
      ctx.lineWidth = rand(1, 2.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(this.x, this.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,' + (alpha * 0.8) + ')';
      ctx.fill();
    };
    for (var ss = 0; ss < 3; ss++) shootingStars.push(new ShootingStar());

    function animate() {
      ctx.clearRect(0, 0, w, h);
      for (var si = 0; si < stars.length; si++) { stars[si].update(); stars[si].draw(); }
      ctx.globalAlpha = 0.035;
      for (var i = 0; i < particles.length; i++) {
        for (var j = i + 1; j < particles.length; j++) {
          var dx = particles[i].x - particles[j].x;
          var dy = particles[i].y - particles[j].y;
          var dist = dx * dx + dy * dy;
          if (dist < 20000) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = particles[i].color;
            ctx.lineWidth = 0.4 + (1 - dist / 20000) * 0.6;
            ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1;
      for (var pi = 0; pi < particles.length; pi++) { particles[pi].update(); particles[pi].draw(); }
      for (var ssi = 0; ssi < shootingStars.length; ssi++) { shootingStars[ssi].update(); shootingStars[ssi].draw(); }
      ctx.globalAlpha = 1;
      requestAnimationFrame(animate);
    }
    resize();
    animate();
    window.addEventListener('resize', resize);
  }

  // ===== 2. SAKURA PETALS (enhanced) =====
  function initSakura(canvas, opts) {
    opts = opts || {};
    var count = opts.count || 20;
    var ctx = canvas.getContext('2d');
    var w, h, petals = [];

    function resize() {
      w = canvas.width = canvas.offsetWidth;
      h = canvas.height = canvas.offsetHeight;
    }

    function Petal() { this.reset(); }
    Petal.prototype.reset = function () {
      this.x = rand(-w * 0.2, w * 1.2);
      this.y = rand(-h, -20);
      this.size = rand(8, 20);
      this.speedY = rand(0.3, 1.2);
      this.speedX = rand(-0.4, 0.4);
      this.rotation = rand(0, Math.PI * 2);
      this.rotSpeed = rand(-0.025, 0.025);
      this.opacity = rand(0.12, 0.45);
      this.swing = rand(0.5, 2.5);
      this.swingSpeed = rand(0.01, 0.035);
      this.phase = rand(0, Math.PI * 2);
      this.color = Math.random() < 0.3 ? COLORS_ARRAY[randInt(0, COLORS_ARRAY.length - 1)] : COLORS.pink;
    };
    Petal.prototype.update = function () {
      this.y += this.speedY;
      this.x += this.speedX + Math.sin(this.phase) * 0.4;
      this.rotation += this.rotSpeed;
      this.phase += this.swingSpeed;
      if (this.y > h + 30) this.reset();
    };
    Petal.prototype.draw = function () {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);
      ctx.globalAlpha = this.opacity;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.moveTo(0, -this.size / 2);
      ctx.quadraticCurveTo(this.size / 2, -this.size / 4, 0, 0);
      ctx.quadraticCurveTo(-this.size / 2, -this.size / 4, 0, -this.size / 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.globalAlpha = this.opacity * 0.4;
      ctx.beginPath();
      ctx.moveTo(0, -this.size / 2);
      ctx.quadraticCurveTo(this.size / 4, -this.size / 4, 0, 0);
      ctx.quadraticCurveTo(-this.size / 4, -this.size / 4, 0, -this.size / 2);
      ctx.fill();
      ctx.restore();
    };
    for (var i = 0; i < count; i++) { var p = new Petal(); p.y = rand(0, h); petals.push(p); }
    function animate() {
      ctx.clearRect(0, 0, w, h);
      for (var i = 0; i < petals.length; i++) { petals[i].update(); petals[i].draw(); }
      requestAnimationFrame(animate);
    }
    resize();
    animate();
    window.addEventListener('resize', resize);
  }

  // ===== 3. MOUSE GLOW TRAIL (enhanced) =====
  function initMouseGlow(canvas) {
    var ctx = canvas.getContext('2d');
    var w, h, trails = [], mouseX = -1000, mouseY = -1000;

    function resize() {
      w = canvas.width = canvas.offsetWidth;
      h = canvas.height = canvas.offsetHeight;
    }
    function onMove(e) {
      var rect = canvas.getBoundingClientRect();
      mouseX = (e.clientX || e.touches?.[0]?.clientX || 0) - rect.left;
      mouseY = (e.clientY || e.touches?.[0]?.clientY || 0) - rect.top;
      trails.push({ x: mouseX, y: mouseY, life: 1 });
      if (trails.length > 40) trails.shift();
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('touchmove', onMove);

    function animate() {
      ctx.clearRect(0, 0, w, h);
      for (var i = 0; i < trails.length; i++) {
        var t = trails[i];
        t.life -= 0.018;
        if (t.life <= 0) continue;
        var alpha = t.life * 0.4;
        var size = (1 - t.life) * 50 + 4;
        var r = 255, g = 114, b = 184;
        var progress = 1 - t.life;
        if (progress < 0.33) { g = 114 + progress * 3 * 40; b = 184 - progress * 3 * 40; }
        else if (progress < 0.66) { r = 255 - (progress - 0.33) * 3 * 60; g = 154 + (progress - 0.33) * 3 * 30; b = 144 - (progress - 0.33) * 3 * 30; }
        var grad = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, size);
        grad.addColorStop(0, 'rgba(' + Math.round(r) + ',' + Math.round(g) + ',' + Math.round(b) + ',' + (alpha * 0.7) + ')');
        grad.addColorStop(0.5, 'rgba(' + Math.round(r * 0.6) + ',' + Math.round(g * 0.6) + ',' + Math.round(b * 0.8) + ',' + (alpha * 0.3) + ')');
        grad.addColorStop(1, 'rgba(85,216,255,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(t.x, t.y, size, 0, Math.PI * 2);
        ctx.fill();
      }
      requestAnimationFrame(animate);
    }
    resize();
    animate();
    window.addEventListener('resize', resize);
  }

  // ===== 4. AMBIENT FLOATING ORBS (enhanced) =====
  function initOrbs(canvas) {
    var ctx = canvas.getContext('2d');
    var w, h, orbs = [];

    function resize() {
      w = canvas.width = canvas.offsetWidth;
      h = canvas.height = canvas.offsetHeight;
    }
    function Orb() {
      this.x = rand(0, w);
      this.y = rand(0, h);
      this.radius = rand(50, 150);
      this.color = COLORS_ARRAY[randInt(0, COLORS_ARRAY.length - 1)];
      this.opacity = rand(0.02, 0.08);
      this.vx = rand(-0.12, 0.12);
      this.vy = rand(-0.12, 0.12);
      this.pulse = rand(0, Math.PI * 2);
    }
    Orb.prototype.update = function () {
      this.x += this.vx;
      this.y += this.vy;
      this.pulse += 0.006;
      if (this.x < -this.radius) this.x = w + this.radius;
      if (this.x > w + this.radius) this.x = -this.radius;
      if (this.y < -this.radius) this.y = h + this.radius;
      if (this.y > h + this.radius) this.y = -this.radius;
    };
    Orb.prototype.draw = function () {
      var alpha = this.opacity + Math.sin(this.pulse) * 0.03;
      var r = parseInt(this.color.slice(1, 3), 16);
      var g = parseInt(this.color.slice(3, 5), 16);
      var b = parseInt(this.color.slice(5, 7), 16);
      var grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius);
      grad.addColorStop(0, 'rgba(' + r + ',' + g + ',' + b + ',' + Math.max(0, Math.min(0.12, alpha)) + ')');
      grad.addColorStop(0.5, 'rgba(' + r + ',' + g + ',' + b + ',' + Math.max(0, Math.min(0.06, alpha * 0.6)) + ')');
      grad.addColorStop(1, 'rgba(' + r + ',' + g + ',' + b + ',0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + Math.max(0, Math.min(0.04, alpha * 0.3)) + ')';
      ctx.fill();
    };
    for (var i = 0; i < 8; i++) orbs.push(new Orb());
    function animate() {
      ctx.clearRect(0, 0, w, h);
      for (var i = 0; i < orbs.length; i++) { orbs[i].update(); orbs[i].draw(); }
      requestAnimationFrame(animate);
    }
    resize();
    animate();
    window.addEventListener('resize', resize);
  }

  // ===== 5. CURSOR SPARKLE TRAIL =====
  function initSparkleTrail(canvas) {
    var ctx = canvas.getContext('2d');
    var w, h, sparkles = [];
    var mouseX = -1000, mouseY = -1000, lastEmit = 0;

    function resize() {
      w = canvas.width = canvas.offsetWidth;
      h = canvas.height = canvas.offsetHeight;
    }
    function onMove(e) {
      var rect = canvas.getBoundingClientRect();
      mouseX = (e.clientX || e.touches?.[0]?.clientX || 0) - rect.left;
      mouseY = (e.clientY || e.touches?.[0]?.clientY || 0) - rect.top;
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('touchmove', onMove);

    function Sparkle() {
      this.x = mouseX;
      this.y = mouseY;
      var angle = rand(0, Math.PI * 2);
      var speed = rand(0.5, 3);
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.size = rand(2, 5);
      this.life = 1;
      this.decay = rand(0.01, 0.03);
      this.color = COLORS_ARRAY[randInt(0, COLORS_ARRAY.length - 1)];
      this.shape = Math.random() < 0.3 ? 'star' : 'circle';
    }
    Sparkle.prototype.update = function () {
      this.x += this.vx;
      this.y += this.vy;
      this.vx *= 0.98;
      this.vy *= 0.98;
      this.life -= this.decay;
      this.size *= 0.995;
    };
    Sparkle.prototype.draw = function () {
      if (this.life <= 0) return;
      ctx.globalAlpha = this.life;
      ctx.fillStyle = this.color;
      if (this.shape === 'star') {
        ctx.beginPath();
        for (var a = 0; a < 5; a++) {
          var angle = a * Math.PI * 2 / 5 - Math.PI / 2;
          var sx = this.x + Math.cos(angle) * this.size;
          var sy = this.y + Math.sin(angle) * this.size;
          if (a === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
          angle += Math.PI / 5;
          sx = this.x + Math.cos(angle) * this.size * 0.4;
          sy = this.y + Math.sin(angle) * this.size * 0.4;
          ctx.lineTo(sx, sy);
        }
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = this.life * 0.15;
      var g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size * 2);
      g.addColorStop(0, this.color);
      g.addColorStop(1, 'transparent');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    };

    function animate() {
      ctx.clearRect(0, 0, w, h);
      lastEmit++;
      if (lastEmit > 2 && mouseX > 0 && mouseY > 0) {
        for (var e = 0; e < 2; e++) sparkles.push(new Sparkle());
        lastEmit = 0;
      }
      for (var i = sparkles.length - 1; i >= 0; i--) {
        sparkles[i].update();
        sparkles[i].draw();
        if (sparkles[i].life <= 0) sparkles.splice(i, 1);
      }
      if (sparkles.length > 200) sparkles.splice(0, sparkles.length - 200);
      requestAnimationFrame(animate);
    }
    resize();
    animate();
    window.addEventListener('resize', resize);
  }

  // ===== 6. FLOATING NEON GEOMETRIC SHAPES =====
  function initNeonShapes(canvas) {
    var ctx = canvas.getContext('2d');
    var w, h, shapes = [];

    function resize() {
      w = canvas.width = canvas.offsetWidth;
      h = canvas.height = canvas.offsetHeight;
    }
    function Shape() {
      this.x = rand(0, w);
      this.y = rand(0, h);
      this.size = rand(20, 60);
      this.type = randInt(0, 3);
      this.color = COLORS_ARRAY[randInt(0, COLORS_ARRAY.length - 1)];
      this.opacity = rand(0.03, 0.08);
      this.vx = rand(-0.2, 0.2);
      this.vy = rand(-0.2, 0.2);
      this.rotation = rand(0, Math.PI * 2);
      this.rotSpeed = rand(-0.005, 0.005);
      this.pulse = rand(0, Math.PI * 2);
    }
    Shape.prototype.update = function () {
      this.x += this.vx;
      this.y += this.vy;
      this.rotation += this.rotSpeed;
      this.pulse += 0.01;
      if (this.x < -50) this.x = w + 50;
      if (this.x > w + 50) this.x = -50;
      if (this.y < -50) this.y = h + 50;
      if (this.y > h + 50) this.y = -50;
    };
    Shape.prototype.draw = function () {
      var alpha = this.opacity + Math.sin(this.pulse) * 0.03;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);
      ctx.globalAlpha = Math.max(0, Math.min(0.15, alpha));
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 1.5;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 15;
      if (this.type === 0) {
        ctx.beginPath();
        for (var i = 0; i < 6; i++) {
          var angle = i * Math.PI * 2 / 6 - Math.PI / 2;
          var px = Math.cos(angle) * this.size;
          var py = Math.sin(angle) * this.size;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      } else if (this.type === 1) {
        ctx.beginPath();
        for (var i = 0; i < 3; i++) {
          var angle = i * Math.PI * 2 / 3 - Math.PI / 2;
          var px = Math.cos(angle) * this.size;
          var py = Math.sin(angle) * this.size;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      } else if (this.type === 2) {
        ctx.beginPath();
        ctx.arc(0, 0, this.size, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, this.size * 0.3, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.rect(-this.size / 2, -this.size / 2, this.size, this.size);
        ctx.stroke();
        ctx.beginPath();
        ctx.rect(-this.size / 4, -this.size / 4, this.size / 2, this.size / 2);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      ctx.restore();
    };
    for (var i = 0; i < 5; i++) shapes.push(new Shape());
    function animate() {
      ctx.clearRect(0, 0, w, h);
      for (var i = 0; i < shapes.length; i++) { shapes[i].update(); shapes[i].draw(); }
      requestAnimationFrame(animate);
    }
    resize();
    animate();
    window.addEventListener('resize', resize);
  }

  // ===== 7. WATER RIPPLE ON CLICK =====
  function initRippleEffect(canvas) {
    var ctx = canvas.getContext('2d');
    var w, h, ripples = [];

    function resize() {
      w = canvas.width = canvas.offsetWidth;
      h = canvas.height = canvas.offsetHeight;
    }
    function onClick(e) {
      var rect = canvas.getBoundingClientRect();
      var x = (e.clientX || 0) - rect.left;
      var y = (e.clientY || 0) - rect.top;
      ripples.push({ x: x, y: y, radius: 0, maxRadius: rand(80, 160), life: 1, speed: rand(3, 6) });
    }
    document.addEventListener('click', onClick);

    function animate() {
      ctx.clearRect(0, 0, w, h);
      for (var i = ripples.length - 1; i >= 0; i--) {
        var r = ripples[i];
        r.radius += r.speed;
        r.life = 1 - r.radius / r.maxRadius;
        if (r.life <= 0) { ripples.splice(i, 1); continue; }
        var grad = ctx.createRadialGradient(r.x, r.y, 0, r.x, r.y, r.radius);
        grad.addColorStop(0, 'rgba(255,255,255,0)');
        grad.addColorStop(0.5, 'rgba(155,123,255,' + (r.life * 0.15) + ')');
        grad.addColorStop(0.8, 'rgba(85,216,255,' + (r.life * 0.1) + ')');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2 * r.life;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius * 0.7, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,' + (r.life * 0.05) + ')';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      requestAnimationFrame(animate);
    }
    resize();
    animate();
    window.addEventListener('resize', resize);
  }

  // ===== 8. SCROLL REVEAL =====
  function initScrollReveal() {
    var els = document.querySelectorAll('.reveal');
    if (!els.length) return;
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
    els.forEach(function (el) { observer.observe(el); });
  }

  // ===== 9. TYPEWRITER =====
  function initTypewriter() {
    var els = document.querySelectorAll('.typewriter');
    els.forEach(function (el) {
      var text = el.textContent;
      el.textContent = '';
      el.style.visibility = 'visible';
      var i = 0;
      function type() {
        if (i < text.length) {
          el.textContent += text.charAt(i);
          i++;
          setTimeout(type, rand(30, 70));
        }
      }
      setTimeout(type, 500);
    });
  }

  // ===== 10. 3D MOUSE PARALLAX =====
  function init3DParallax() {
    var containers = document.querySelectorAll('.parallax-3d');
    containers.forEach(function (container) {
      var strength = parseFloat(container.getAttribute('data-strength')) || 20;
      container.addEventListener('mousemove', function (e) {
        var rect = container.getBoundingClientRect();
        var x = (e.clientX - rect.left) / rect.width - 0.5;
        var y = (e.clientY - rect.top) / rect.height - 0.5;
        var children = container.querySelectorAll('.parallax-layer');
        children.forEach(function (child) {
          var depth = parseFloat(child.getAttribute('data-depth')) || 1;
          child.style.transform = 'translateX(' + (x * strength * depth) + 'px) translateY(' + (y * strength * depth) + 'px) scale(' + (1 + Math.abs(x * y * 0.1 * depth)) + ')';
        });
      });
      container.addEventListener('mouseleave', function () {
        var children = container.querySelectorAll('.parallax-layer');
        children.forEach(function (child) {
          child.style.transform = 'translateX(0) translateY(0) scale(1)';
          child.style.transition = 'transform 0.5s cubic-bezier(0.23,1,0.32,1)';
          setTimeout(function () { child.style.transition = ''; }, 500);
        });
      });
    });
  }

  // ===================== INIT ALL =====================
  document.addEventListener('DOMContentLoaded', function () {
    var canvases = document.querySelectorAll('canvas.sekai-starfield');
    canvases.forEach(function (c) {
      var count = parseInt(c.getAttribute('data-count')) || 120;
      initStarfield(c, { count: count });
    });
    var sakuraCanvases = document.querySelectorAll('canvas.sekai-sakura');
    sakuraCanvases.forEach(function (c) {
      var count = parseInt(c.getAttribute('data-count')) || 20;
      initSakura(c, { count: count });
    });
    var glowCanvases = document.querySelectorAll('canvas.sekai-glow');
    glowCanvases.forEach(function (c) { initMouseGlow(c); });
    var orbCanvases = document.querySelectorAll('canvas.sekai-orbs');
    orbCanvases.forEach(function (c) { initOrbs(c); });
    var sparkleCanvases = document.querySelectorAll('canvas.sekai-sparkles');
    sparkleCanvases.forEach(function (c) { initSparkleTrail(c); });
    var shapeCanvases = document.querySelectorAll('canvas.sekai-neon-shapes');
    shapeCanvases.forEach(function (c) { initNeonShapes(c); });
    var rippleCanvases = document.querySelectorAll('canvas.sekai-ripple-effect');
    rippleCanvases.forEach(function (c) { initRippleEffect(c); });

    initScrollReveal();
    initTypewriter();
    init3DParallax();

    // Enhanced tilt effect
    document.addEventListener('mousemove', function (e) {
      var cards = document.querySelectorAll('.tilt-card');
      cards.forEach(function (card) {
        var rect = card.getBoundingClientRect();
        var x = e.clientX - rect.left;
        var y = e.clientY - rect.top;
        if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
          card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0)';
          return;
        }
        var rotateX = ((y / rect.height) - 0.5) * -20;
        var rotateY = ((x / rect.width) - 0.5) * 20;
        card.style.transform = 'perspective(1000px) rotateX(' + rotateX + 'deg) rotateY(' + rotateY + 'deg) translateZ(15px) scale(1.02)';
        var gx = ((x / rect.width) * 100) + '%';
        var gy = ((y / rect.height) * 100) + '%';
        card.style.setProperty('--glow-x', gx);
        card.style.setProperty('--glow-y', gy);
      });
    });
    document.addEventListener('mouseleave', function (e) {
      document.querySelectorAll('.tilt-card').forEach(function (card) {
        card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0) scale(1)';
      });
    }, true);

    // Button Ripple
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('.sekai-btn, .primary-btn, .secondary-btn, .hero-btn, .card-btn, .sidebar-btn');
      if (!btn) return;
      var ripple = document.createElement('span');
      ripple.className = 'sekai-ripple';
      var rect = btn.getBoundingClientRect();
      var size = Math.max(rect.width, rect.height);
      ripple.style.width = ripple.style.height = size + 'px';
      ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
      ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
      btn.style.position = btn.style.position || 'relative';
      btn.style.overflow = 'hidden';
      btn.appendChild(ripple);
      setTimeout(function () { ripple.remove(); }, 600);
    });

    document.querySelectorAll('.float-el').forEach(function (el, i) {
      el.style.animationDelay = (i * 0.7) + 's';
    });
    document.querySelectorAll('.glow-pulse').forEach(function (el, i) {
      el.style.animationDelay = (i * 0.4) + 's';
      el.style.animationDuration = (2.5 + Math.random() * 2) + 's';
    });
  });
})();
