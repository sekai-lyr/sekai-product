(function () {
  'use strict';

  var COLORS = {
    sakuraLight: '#ffc0cb', sakura: '#ff8da1', sakuraDeep: '#e8607a',
    pink: '#ff72b8', pinkWhite: '#fff0f5', purple: '#c49bff', cyan: '#7ad8ff',
    mint: '#79e6c5', sun: '#ffd76f', white: '#ffeef2'
  };
  var SAKURA_COLORS = ['#ffc0cb','#ffb7c5','#ff8da1','#ff72b8','#ff9eb5','#ffd1dc','#fff0f5','#f8a5b8','#e8929e','#ffced6'];
  var COLORS_ARRAY = ['#ff72b8','#ffc0cb','#ff8da1','#e8607a','#c49bff','#7ad8ff'];
  var STREAM_CHARS = '01アイウエオカキクケコサシスセソタチツテトナニヌネハヒフヘホマミムメモヤユヨラリルレロワヲン';

  function rand(min, max) { return Math.random() * (max - min) + min; }
  function randInt(min, max) { return Math.floor(rand(min, max + 1)); }
  function pick(arr) { return arr[randInt(0, arr.length - 1)]; }

  // ===== 1. STARFIELD + DATA STREAM + LIGHT SCAN =====
  function initStarfield(canvas, opts) {
    opts = opts || {};
    var count = opts.count || 100;
    var ctx = canvas.getContext('2d');
    var w = canvas.offsetWidth || window.innerWidth;
    var h = canvas.offsetHeight || window.innerHeight;
    var particles = [], stars = [], shootingStars = [], scans = [], streams = [];
    canvas.width = w;
    canvas.height = h;

    function resize() {
      w = canvas.width = canvas.offsetWidth;
      h = canvas.height = canvas.offsetHeight;
      // rebuild streams on resize
      streams = [];
      for (var si = 0; si < 20; si++) streams.push(new DataStream());
      scans = [];
      for (var sc = 0; sc < 3; sc++) scans.push(new LightScan(sc * h / 3));
    }

    // --- Stars ---
    function Star() {
      this.x = Math.random() * w;
      this.y = Math.random() * h;
      this.size = rand(0.3, 2.2);
      this.opacity = rand(0.15, 0.9);
      this.speed = rand(0.0002, 0.0015);
      this.phase = rand(0, Math.PI * 2);
      this.color = pick(COLORS_ARRAY);
      this.isColor = Math.random() < 0.2;
    }
    Star.prototype.update = function () { this.phase += this.speed; };
    Star.prototype.draw = function () {
      var alpha = this.opacity * (0.5 + 0.5 * Math.sin(this.phase));
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = this.isColor ? this.color : '#fff';
      ctx.globalAlpha = alpha;
      ctx.fill();
      if (this.isColor && this.size > 1.0) {
        ctx.globalAlpha = alpha * 0.2;
        var g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size * 4);
        g.addColorStop(0, this.color); g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.size * 4, 0, Math.PI * 2); ctx.fill();
      }
    };
    for (var s = 0; s < 100; s++) stars.push(new Star());

    // --- Particles ---
    function Particle() {
      this.x = Math.random() * w;
      this.y = Math.random() * h;
      this.vx = rand(-0.5, 0.5); this.vy = rand(-0.5, 0.5);
      this.size = rand(1, 3.5);
      this.color = pick(COLORS_ARRAY);
      this.opacity = rand(0.2, 0.8); this.pulse = rand(0, Math.PI * 2);
    }
    Particle.prototype.update = function () {
      this.x += this.vx; this.y += this.vy; this.pulse += 0.03;
      if (this.x < -30) this.x = w + 30; if (this.x > w + 30) this.x = -30;
      if (this.y < -30) this.y = h + 30; if (this.y > h + 30) this.y = -30;
    };
    Particle.prototype.draw = function () {
      var alpha = this.opacity + Math.sin(this.pulse) * 0.2;
      ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.globalAlpha = Math.max(0.05, Math.min(1, alpha)); ctx.fill();
      ctx.globalAlpha = alpha * 0.08;
      var g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size * 3);
      g.addColorStop(0, this.color); g.addColorStop(1, 'transparent');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(this.x, this.y, this.size * 3, 0, Math.PI * 2); ctx.fill();
    };
    for (var i = 0; i < count; i++) particles.push(new Particle());

    // --- Shooting Stars ---
    function ShootingStar() { this.reset(true); }
    ShootingStar.prototype.reset = function (instant) {
      this.x = rand(0, w); this.y = rand(0, h * 0.4);
      this.len = rand(60, 180); this.speed = rand(6, 14);
      this.angle = rand(0.3, 0.8); this.opacity = rand(0.4, 0.8);
      this.life = 0; this.maxLife = rand(20, 40);
      this.active = instant || false; this.wait = rand(80, 350);
    };
    ShootingStar.prototype.update = function () {
      if (!this.active) { this.wait--; if (this.wait <= 0) this.active = true; return; }
      this.life++; this.x += this.speed; this.y += this.speed * this.angle;
      if (this.life > this.maxLife || this.x > w + 50 || this.y > h + 50) this.reset();
    };
    ShootingStar.prototype.draw = function () {
      if (!this.active) return;
      var alpha = this.opacity * (1 - this.life / this.maxLife);
      var g = ctx.createLinearGradient(this.x, this.y, this.x - this.len, this.y - this.len * this.angle);
      g.addColorStop(0, 'rgba(255,222,230,' + alpha + ')'); g.addColorStop(1, 'rgba(255,222,230,0)');
      ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(this.x - this.len, this.y - this.len * this.angle);
      ctx.strokeStyle = g; ctx.lineWidth = rand(1, 2.5); ctx.stroke();
      ctx.beginPath(); ctx.arc(this.x, this.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,' + (alpha * 0.8) + ')'; ctx.fill();
    };
    for (var ss = 0; ss < 3; ss++) shootingStars.push(new ShootingStar());

    // --- DATA STREAM (vertical digital rain, sakura themed) ---
    function DataStream() {
      this.x = rand(10, w - 10);
      this.length = randInt(8, 25);
      this.drops = [];
      this.speed = rand(0.6, 2.0);
      this.opacity = rand(0.04, 0.12);
      this.charSize = rand(10, 15);
      this.color = pick(SAKURA_COLORS);
      this.headY = rand(-h, 0);
      for (var d = 0; d < this.length; d++) {
        this.drops.push({ ch: STREAM_CHARS[randInt(0, STREAM_CHARS.length - 1)], offset: d * (rand(18, 30) + this.charSize) });
      }
    }
    DataStream.prototype.update = function () {
      this.headY += this.speed;
      if (this.headY > h + this.length * 30) { this.headY = rand(-200, -20); this.x = rand(10, w - 10); this.speed = rand(0.6, 2.0); }
    };
    DataStream.prototype.draw = function () {
      ctx.font = this.charSize + 'px "Microsoft YaHei", monospace';
      ctx.textAlign = 'center';
      for (var d = 0; d < this.drops.length; d++) {
        var dy = this.headY - this.drops[d].offset;
        if (dy < -20 || dy > h + 20) continue;
        var alpha = this.opacity * (1 - d / this.drops.length);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.color;
        ctx.fillText(this.drops[d].ch, this.x, dy);
        // leading character brighter
        if (d === 0) { ctx.globalAlpha = alpha * 2.5; ctx.fillStyle = '#fff'; ctx.fillText(this.drops[d].ch, this.x, dy); }
      }
    };

    // --- LIGHT SCAN BEAM (horizontal sweeping) ---
    function LightScan(startY) {
      this.y = startY || rand(0, h);
      this.speed = rand(0.2, 0.6);
      this.height = rand(2, 5);
      this.opacity = rand(0.03, 0.08);
      this.color = pick(['#ffc0cb','#ff8da1','#ffb7c5']);
      this.flickerPhase = rand(0, Math.PI * 2);
    }
    LightScan.prototype.update = function () {
      this.y += this.speed;
      if (this.y > h + 20) this.y = -20;
      this.flickerPhase += 0.04;
    };
    LightScan.prototype.draw = function () {
      var alpha = this.opacity + Math.sin(this.flickerPhase) * 0.02;
      var hx = this.color;
      var r = parseInt(hx.slice(1,3),16), g = parseInt(hx.slice(3,5),16), b = parseInt(hx.slice(5,7),16);
      var grad = ctx.createLinearGradient(0, this.y - this.height, 0, this.y + this.height);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(0.35, 'rgba('+r+','+g+','+b+','+ alpha +')');
      grad.addColorStop(0.5, 'rgba(255,240,245,' + (alpha * 1.2) + ')');
      grad.addColorStop(0.65, 'rgba('+r+','+g+','+b+','+ alpha +')');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.globalAlpha = 1;
      ctx.fillStyle = grad;
      ctx.fillRect(0, this.y - this.height * 6, w, this.height * 12);
      ctx.fillStyle = 'rgba(255,220,230,' + (alpha * 1.5) + ')';
      ctx.beginPath(); ctx.arc(rand(0, w), this.y, 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(rand(0, w), this.y, 1.5, 0, Math.PI * 2); ctx.fill();
    };

    // --- Animate ---
    function animate() {
      ctx.clearRect(0, 0, w, h);

      // Draw light scans first (background layer)
      for (var sci = 0; sci < scans.length; sci++) { scans[sci].update(); scans[sci].draw(); }

      // Draw data streams
      for (var si = 0; si < streams.length; si++) { streams[si].update(); streams[si].draw(); }

      // Stars
      for (var sti = 0; sti < stars.length; sti++) { stars[sti].update(); stars[sti].draw(); }

      // Particle connections
      ctx.globalAlpha = 0.03;
      for (var i = 0; i < particles.length; i++) {
        for (var j = i + 1; j < particles.length; j++) {
          var dx = particles[i].x - particles[j].x;
          var dy = particles[i].y - particles[j].y;
          var dist = dx * dx + dy * dy;
          if (dist < 20000) {
            ctx.beginPath(); ctx.moveTo(particles[i].x, particles[i].y); ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = particles[i].color; ctx.lineWidth = 0.4 + (1 - dist / 20000) * 0.6; ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1;

      // Particles
      for (var pi = 0; pi < particles.length; pi++) { particles[pi].update(); particles[pi].draw(); }

      // Shooting stars
      for (var ssi = 0; ssi < shootingStars.length; ssi++) { shootingStars[ssi].update(); shootingStars[ssi].draw(); }

      ctx.globalAlpha = 1;
      requestAnimationFrame(animate);
    }
    resize();
    animate();
    window.addEventListener('resize', resize);
  }

  // ===== 2. SAKURA PETALS – floating, rotating, fading =====
  function initSakura(canvas, opts) {
    opts = opts || {};
    var count = opts.count || 90;
    var ctx = canvas.getContext('2d');
    var w = window.innerWidth;
    var h = window.innerHeight;
    var petals = [];

    // A canvas keeps its intrinsic 300x150 size when only `inset: 0` is set.
    // Force the effect to cover the viewport and keep it above page backgrounds.
    canvas.style.position = 'fixed';
    canvas.style.left = '0';
    canvas.style.top = '0';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.zIndex = '20';
    canvas.style.pointerEvents = 'none';
    canvas.style.display = 'block';
    canvas.width = w;
    canvas.height = h;

    function resize() {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    }

    function Petal() { this.reset(true); }
    Petal.prototype.reset = function (initial) {
      this.x = rand(-w * 0.3, w * 1.3);
      this.y = initial ? rand(-h, h) : rand(-h, -40);
      var depth = rand(0.55, 1.45);
      this.size = rand(13, 30) * depth;
      this.speedY = rand(0.65, 1.8) * depth;
      this.speedX = rand(-0.7, 0.85) * depth;
      this.rotation = rand(0, Math.PI * 2);
      this.rotSpeed = rand(-0.015, 0.015);
      this.opacity = rand(0.38, 0.82);
      this.swingAmp = rand(1.8, 5.5) * depth;
      this.swingSpeed = rand(0.012, 0.035);
      this.phase = rand(0, Math.PI * 2);
      this.color = pick(SAKURA_COLORS);
      this.type = Math.random() < 0.14 ? 'flower' : 'petal';
    };
    Petal.prototype.update = function () {
      this.y += this.speedY;
      this.x += this.speedX + Math.sin(this.phase) * this.swingAmp;
      this.rotation += this.rotSpeed;
      this.phase += this.swingSpeed;
      // fade out near bottom
      if (this.y > h * 0.7) this.currentOpacity = this.opacity * (1 - (this.y - h * 0.7) / (h * 0.3));
      else this.currentOpacity = this.opacity;
      if (this.y > h + 60) this.reset(false);
    };
    Petal.prototype.draw = function () {
      var alpha = Math.max(0, this.currentOpacity);
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);
      var s = this.size;

      if (this.type === 'flower') {
        // 5-petal flower
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.color;
        for (var a = 0; a < 5; a++) {
          var angle = a * Math.PI * 2 / 5 - Math.PI / 2;
          ctx.beginPath();
          ctx.save();
          ctx.translate(Math.cos(angle) * s * 0.12, Math.sin(angle) * s * 0.12);
          ctx.rotate(angle);
          ctx.moveTo(0, -s * 0.32);
          ctx.bezierCurveTo(s * 0.2, -s * 0.15, s * 0.2, s * 0.1, 0, s * 0.18);
          ctx.bezierCurveTo(-s * 0.2, s * 0.1, -s * 0.2, -s * 0.15, 0, -s * 0.32);
          ctx.fill();
          ctx.restore();
        }
        // center dot
        ctx.globalAlpha = alpha * 0.5;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(0, 0, s * 0.06, 0, Math.PI * 2); ctx.fill();
      } else {
        // Teardrop petal
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.55);
        ctx.bezierCurveTo(s * 0.38, -s * 0.22, s * 0.38, s * 0.15, 0, s * 0.3);
        ctx.bezierCurveTo(-s * 0.38, s * 0.15, -s * 0.38, -s * 0.22, 0, -s * 0.55);
        ctx.fill();

        // light center vein
        ctx.globalAlpha = alpha * 0.25;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.28);
        ctx.bezierCurveTo(s * 0.1, -s * 0.06, s * 0.1, s * 0.05, 0, s * 0.1);
        ctx.bezierCurveTo(-s * 0.1, s * 0.05, -s * 0.1, -s * 0.06, 0, -s * 0.28);
        ctx.fill();
      }
      ctx.restore();
    };
    for (var i = 0; i < count; i++) petals.push(new Petal());

    function animate() {
      ctx.clearRect(0, 0, w, h);
      for (var i = 0; i < petals.length; i++) { petals[i].update(); petals[i].draw(); }
      requestAnimationFrame(animate);
    }
    resize();
    animate();
    window.addEventListener('resize', resize);
  }

  // ===== 3. MOUSE GLOW TRAIL =====
  function initMouseGlow(canvas) {
    var ctx = canvas.getContext('2d');
    var w, h, trails = [], mouseX = -1000, mouseY = -1000;

    function resize() { w = canvas.width = canvas.offsetWidth; h = canvas.height = canvas.offsetHeight; }
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
        var t = trails[i]; t.life -= 0.018; if (t.life <= 0) continue;
        var alpha = t.life * 0.35;
        var size = (1 - t.life) * 45 + 3;
        var grad = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, size);
        grad.addColorStop(0, 'rgba(255,141,161,' + (alpha * 0.7) + ')');
        grad.addColorStop(0.5, 'rgba(255,183,197,' + (alpha * 0.3) + ')');
        grad.addColorStop(1, 'rgba(255,183,197,0)');
        ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(t.x, t.y, size, 0, Math.PI * 2); ctx.fill();
      }
      requestAnimationFrame(animate);
    }
    resize(); animate();
    window.addEventListener('resize', resize);
  }

  // ===== 4. FLOATING ORBS =====
  function initOrbs(canvas) {
    var ctx = canvas.getContext('2d'); var w, h, orbs = [];
    function resize() { w = canvas.width = canvas.offsetWidth; h = canvas.height = canvas.offsetHeight; }
    function Orb() {
      this.x = rand(0, w); this.y = rand(0, h); this.radius = rand(50, 150);
      this.color = pick(COLORS_ARRAY); this.opacity = rand(0.015, 0.06);
      this.vx = rand(-0.12, 0.12); this.vy = rand(-0.12, 0.12); this.pulse = rand(0, Math.PI * 2);
    }
    Orb.prototype.update = function () {
      this.x += this.vx; this.y += this.vy; this.pulse += 0.006;
      if (this.x < -this.radius) this.x = w + this.radius; if (this.x > w + this.radius) this.x = -this.radius;
      if (this.y < -this.radius) this.y = h + this.radius; if (this.y > h + this.radius) this.y = -this.radius;
    };
    Orb.prototype.draw = function () {
      var alpha = this.opacity + Math.sin(this.pulse) * 0.02;
      var r = parseInt(this.color.slice(1, 3), 16), g = parseInt(this.color.slice(3, 5), 16), b = parseInt(this.color.slice(5, 7), 16);
      var grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius);
      grad.addColorStop(0, 'rgba(' + r + ',' + g + ',' + b + ',' + Math.min(0.08, alpha) + ')');
      grad.addColorStop(0.5, 'rgba(' + r + ',' + g + ',' + b + ',' + Math.min(0.04, alpha * 0.6) + ')');
      grad.addColorStop(1, 'rgba(' + r + ',' + g + ',' + b + ',0)');
      ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); ctx.fill();
    };
    for (var i = 0; i < 6; i++) orbs.push(new Orb());
    function animate() { ctx.clearRect(0, 0, w, h); for (var i = 0; i < orbs.length; i++) { orbs[i].update(); orbs[i].draw(); } requestAnimationFrame(animate); }
    resize(); animate();
    window.addEventListener('resize', resize);
  }

  // ===== 5. CURSOR SPARKLE TRAIL =====
  function initSparkleTrail(canvas) {
    var ctx = canvas.getContext('2d'); var w, h, sparkles = [], mouseX = -1000, mouseY = -1000, lastEmit = 0;
    function resize() { w = canvas.width = canvas.offsetWidth; h = canvas.height = canvas.offsetHeight; }
    function onMove(e) {
      var rect = canvas.getBoundingClientRect();
      mouseX = (e.clientX || e.touches?.[0]?.clientX || 0) - rect.left;
      mouseY = (e.clientY || e.touches?.[0]?.clientY || 0) - rect.top;
    }
    document.addEventListener('mousemove', onMove); document.addEventListener('touchmove', onMove);
    function Sparkle() {
      this.x = mouseX; this.y = mouseY;
      var angle = rand(0, Math.PI * 2), speed = rand(0.5, 3);
      this.vx = Math.cos(angle) * speed; this.vy = Math.sin(angle) * speed;
      this.size = rand(2, 5); this.life = 1; this.decay = rand(0.01, 0.03);
      this.color = pick(COLORS_ARRAY);
    }
    Sparkle.prototype.update = function () { this.x += this.vx; this.y += this.vy; this.vx *= 0.98; this.vy *= 0.98; this.life -= this.decay; this.size *= 0.995; };
    Sparkle.prototype.draw = function () {
      if (this.life <= 0) return;
      ctx.globalAlpha = this.life; ctx.fillStyle = this.color;
      ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = this.life * 0.12;
      var g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size * 2);
      g.addColorStop(0, this.color); g.addColorStop(1, 'transparent');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(this.x, this.y, this.size * 2, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    };
    function animate() {
      ctx.clearRect(0, 0, w, h); lastEmit++;
      if (lastEmit > 2 && mouseX > 0 && mouseY > 0) { for (var e = 0; e < 2; e++) sparkles.push(new Sparkle()); lastEmit = 0; }
      for (var i = sparkles.length - 1; i >= 0; i--) { sparkles[i].update(); sparkles[i].draw(); if (sparkles[i].life <= 0) sparkles.splice(i, 1); }
      if (sparkles.length > 200) sparkles.splice(0, sparkles.length - 200);
      requestAnimationFrame(animate);
    }
    resize(); animate();
    window.addEventListener('resize', resize);
  }

  // ===== 6. NEON GEOMETRIC SHAPES =====
  function initNeonShapes(canvas) {
    var ctx = canvas.getContext('2d'); var w, h, shapes = [];
    function resize() { w = canvas.width = canvas.offsetWidth; h = canvas.height = canvas.offsetHeight; }
    function Shape() {
      this.x = rand(0, w); this.y = rand(0, h); this.size = rand(20, 60); this.type = randInt(0, 3);
      this.color = pick(COLORS_ARRAY); this.opacity = rand(0.02, 0.06);
      this.vx = rand(-0.2, 0.2); this.vy = rand(-0.2, 0.2);
      this.rotation = rand(0, Math.PI * 2); this.rotSpeed = rand(-0.005, 0.005); this.pulse = rand(0, Math.PI * 2);
    }
    Shape.prototype.update = function () {
      this.x += this.vx; this.y += this.vy; this.rotation += this.rotSpeed; this.pulse += 0.01;
      if (this.x < -50) this.x = w + 50; if (this.x > w + 50) this.x = -50;
      if (this.y < -50) this.y = h + 50; if (this.y > h + 50) this.y = -50;
    };
    Shape.prototype.draw = function () {
      var alpha = this.opacity + Math.sin(this.pulse) * 0.02;
      ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.rotation);
      ctx.globalAlpha = Math.min(0.12, alpha); ctx.strokeStyle = this.color; ctx.lineWidth = 1.5;
      ctx.shadowColor = this.color; ctx.shadowBlur = 15;
      if (this.type === 0) { var hs = this.size * 0.7; ctx.beginPath(); for (var i = 0; i < 6; i++) { var a6 = i * Math.PI * 2 / 6; var px = Math.cos(a6) * hs, py = Math.sin(a6) * hs; if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); } ctx.closePath(); ctx.stroke(); }
      else if (this.type === 1) { ctx.beginPath(); ctx.arc(0, 0, this.size * 0.5, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, this.size * 0.15, 0, Math.PI * 2); ctx.stroke(); }
      else { ctx.beginPath(); ctx.rect(-this.size * 0.35, -this.size * 0.35, this.size * 0.7, this.size * 0.7); ctx.stroke(); }
      ctx.shadowBlur = 0; ctx.restore();
    };
    for (var i = 0; i < 5; i++) shapes.push(new Shape());
    function animate() { ctx.clearRect(0, 0, w, h); for (var i = 0; i < shapes.length; i++) { shapes[i].update(); shapes[i].draw(); } requestAnimationFrame(animate); }
    resize(); animate();
    window.addEventListener('resize', resize);
  }

  // ===== 7. CLICK RIPPLE =====
  function initRippleEffect(canvas) {
    var ctx = canvas.getContext('2d'); var w, h, ripples = [];
    function resize() { w = canvas.width = canvas.offsetWidth; h = canvas.height = canvas.offsetHeight; }
    function onClick(e) {
      var rect = canvas.getBoundingClientRect(), x = (e.clientX || 0) - rect.left, y = (e.clientY || 0) - rect.top;
      ripples.push({ x: x, y: y, radius: 0, maxRadius: rand(80, 160), life: 1, speed: rand(3, 6) });
    }
    document.addEventListener('click', onClick);
    function animate() {
      ctx.clearRect(0, 0, w, h);
      for (var i = ripples.length - 1; i >= 0; i--) {
        var r = ripples[i]; r.radius += r.speed; r.life = 1 - r.radius / r.maxRadius;
        if (r.life <= 0) { ripples.splice(i, 1); continue; }
        var grad = ctx.createRadialGradient(r.x, r.y, 0, r.x, r.y, r.radius);
        grad.addColorStop(0, 'rgba(255,255,255,0)');
        grad.addColorStop(0.5, 'rgba(255,141,161,' + (r.life * 0.18) + ')');
        grad.addColorStop(0.8, 'rgba(255,183,197,' + (r.life * 0.1) + ')');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.beginPath(); ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2); ctx.strokeStyle = grad; ctx.lineWidth = 2 * r.life; ctx.stroke();
      }
      requestAnimationFrame(animate);
    }
    resize(); animate();
    window.addEventListener('resize', resize);
  }

  // ===== 8. SCROLL REVEAL =====
  function initScrollReveal() {
    var els = document.querySelectorAll('.reveal'); if (!els.length) return;
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) { if (entry.isIntersecting) { entry.target.classList.add('revealed'); observer.unobserve(entry.target); } });
    }, { threshold: 0.1 });
    els.forEach(function (el) { observer.observe(el); });
  }

  // ===== 9. TYPEWRITER =====
  function initTypewriter() {
    document.querySelectorAll('.typewriter').forEach(function (el) {
      var text = el.textContent; el.textContent = ''; el.style.visibility = 'visible'; var i = 0;
      function type() { if (i < text.length) { el.textContent += text.charAt(i); i++; setTimeout(type, rand(30, 70)); } }
      setTimeout(type, 500);
    });
  }

  // ===== 10. 3D PARALLAX =====
  function init3DParallax() {
    document.querySelectorAll('.parallax-3d').forEach(function (container) {
      var strength = parseFloat(container.getAttribute('data-strength')) || 20;
      container.addEventListener('mousemove', function (e) {
        var rect = container.getBoundingClientRect(), x = (e.clientX - rect.left) / rect.width - 0.5, y = (e.clientY - rect.top) / rect.height - 0.5;
        container.querySelectorAll('.parallax-layer').forEach(function (child) {
          var depth = parseFloat(child.getAttribute('data-depth')) || 1;
          child.style.transform = 'translateX(' + (x * strength * depth) + 'px) translateY(' + (y * strength * depth) + 'px) scale(' + (1 + Math.abs(x * y * 0.1 * depth)) + ')';
        });
      });
      container.addEventListener('mouseleave', function () {
        container.querySelectorAll('.parallax-layer').forEach(function (child) { child.style.transform = 'translateX(0) translateY(0) scale(1)'; child.style.transition = 'transform 0.5s cubic-bezier(0.23,1,0.32,1)'; setTimeout(function () { child.style.transition = ''; }, 500); });
      });
    });
  }

  // ===================== INIT =====================
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('canvas.sekai-starfield').forEach(function (c) {
      c.style.display = 'none';
    });
    document.querySelectorAll('canvas.sekai-sakura').forEach(function (c) {
      var requestedCount = parseInt(c.getAttribute('data-count')) || 0;
      var spectacularCount = window.innerWidth < 768 ? 55 : 100;
      initSakura(c, { count: Math.max(requestedCount, spectacularCount) });
    });
    document.querySelectorAll('canvas.sekai-glow').forEach(function (c) { initMouseGlow(c); });
    document.querySelectorAll('canvas.sekai-orbs').forEach(function (c) { initOrbs(c); });
    document.querySelectorAll('canvas.sekai-sparkles').forEach(function (c) { initSparkleTrail(c); });
    document.querySelectorAll('canvas.sekai-neon-shapes').forEach(function (c) { initNeonShapes(c); });
    document.querySelectorAll('canvas.sekai-ripple-effect').forEach(function (c) { initRippleEffect(c); });

    initScrollReveal(); initTypewriter(); init3DParallax();

    // Tilt cards
    document.addEventListener('mousemove', function (e) {
      document.querySelectorAll('.tilt-card').forEach(function (card) {
        var rect = card.getBoundingClientRect(), x = e.clientX - rect.left, y = e.clientY - rect.top;
        if (x < 0 || y < 0 || x > rect.width || y > rect.height) { card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0)'; return; }
        var rx = ((y / rect.height) - 0.5) * -20, ry = ((x / rect.width) - 0.5) * 20;
        card.style.transform = 'perspective(1000px) rotateX(' + rx + 'deg) rotateY(' + ry + 'deg) translateZ(15px) scale(1.02)';
        card.style.setProperty('--glow-x', ((x / rect.width) * 100) + '%');
        card.style.setProperty('--glow-y', ((y / rect.height) * 100) + '%');
      });
    });
    document.addEventListener('mouseleave', function () {
      document.querySelectorAll('.tilt-card').forEach(function (card) { card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0) scale(1)'; });
    }, true);

    // Button ripple
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('.sekai-btn, .primary-btn, .secondary-btn, .hero-btn, .card-btn, .sidebar-btn');
      if (!btn) return;
      var ripple = document.createElement('span'); ripple.className = 'sekai-ripple';
      var rect = btn.getBoundingClientRect(), size = Math.max(rect.width, rect.height);
      ripple.style.width = ripple.style.height = size + 'px';
      ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
      ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
      btn.style.position = btn.style.position || 'relative'; btn.style.overflow = 'hidden';
      btn.appendChild(ripple);
      setTimeout(function () { ripple.remove(); }, 600);
    });

    document.querySelectorAll('.float-el').forEach(function (el, i) { el.style.animationDelay = (i * 0.7) + 's'; });
    document.querySelectorAll('.glow-pulse').forEach(function (el, i) { el.style.animationDelay = (i * 0.4) + 's'; el.style.animationDuration = (2.5 + Math.random() * 2) + 's'; });
  });
})();
