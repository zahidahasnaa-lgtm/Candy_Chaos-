const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const W = 420, H = 700;
const R = 16;
const DX = 34, DY = 27.7;
const COLS = 11;
const TOP = 27;

const COLORS = ["#ff5799", "#bd65f4", "#ffb42f", "#42c9e8"];

const $ = id => document.getElementById(id);

let level = 1;
let score = 0;
let popped = 0;
let target = 20;
let shotsLeft = 30;
let bubbles = [];
let particles = [];
let projectile = null;
let paused = false;
let ended = false;
let won = false;
let aim = { x: 210, y: 200 };
let currentColor = 0;
let nextColor = 1;
let lastTime = 0;
let bestScore = 0;

const shooter = { x: 210, y: 620 };

function randomColor() {
  return Math.floor(Math.random() * COLORS.length);
}

function cx(row, col) {
  return (W - COLS * DX) / 2 + DX / 2 +
    col * DX + (row % 2 ? DX / 2 : 0);
}

function cy(row) {
  return TOP + R + row * DY;
}

function center(b) {
  return { x: cx(b.row, b.col), y: cy(b.row) };
}

function findBubble(row, col) {
  return bubbles.find(b => b.row === row && b.col === col);
}

function neighbors(row, col) {
  const offsets = row % 2 === 0
    ? [[0,-1],[0,1],[-1,-1],[-1,0],[1,-1],[1,0]]
    : [[0,-1],[0,1],[-1,0],[-1,1],[1,0],[1,1]];

  return offsets
    .map(([dr, dc]) => [row + dr, col + dc])
    .filter(([r,c]) => r >= 0 && r < 30 && c >= 0 && c < COLS);
}

// ========== LEVEL ==========

function startLevel(n) {
  level = n;
  score = 0;
  popped = 0;
  target = 20 + (level - 1) * 8;
  shotsLeft = Math.max(18, 32 - Math.floor((level - 1) / 2) * 2);

  bubbles = [];
  particles = [];
  projectile = null;
  paused = false;
  ended = false;
  won = false;

  currentColor = randomColor();
  nextColor = randomColor();

  // Level makin tinggi, tumpukan makin besar.
  const rows = Math.min(5 + level, 14);
  const colorCount = Math.min(2 + Math.floor((level - 1) / 2), 4);

  // Membuat kelompok warna agar bisa dimainkan.
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < COLS; col++) {
      // Membuat beberapa celah untuk strategi.
      if (row > 1 && Math.random() < 0.09 + Math.min(level * 0.008, 0.1)) {
        continue;
      }

      // Pola kelompok dengan warna yang sama.
      const block = Math.floor(col / 3) + Math.floor(row / 2);
      const color = block % colorCount;

      bubbles.push({
        row,
        col,
        color: Math.random() < 0.12 ? randomColor() : color
      });
    }
  }

  // Pastikan level selalu punya permen yang dapat dicocokkan.
  currentColor = bubbles.length ? bubbles[0].color : randomColor();

  $("message").textContent = "Level " + level + " — Ayo pecahkan permen! 🍬";
  $("pause").textContent = "⏸ PAUSE";
  updateHUD();
  draw();
}

function updateHUD() {
  $("level").textContent = level;
  $("score").textContent = score;
  $("target").textContent = Math.max(0, target - popped);
  $("shots").textContent = shotsLeft;

  const stars = score >= target * 30 ? 3 :
                score >= target * 20 ? 2 :
                score >= target * 10 ? 1 : 0;

  $("stars").innerHTML = [0,1,2].map(i =>
    `<span class="${i < stars ? "on" : ""}">${
      i < stars ? "★" : "☆"
    }</span>`
  ).join(" ");
}

// ========== GAMBAR PERMEN ==========

function candy(x, y, color, radius = R) {
  ctx.save();

  ctx.shadowColor = "#81517a55";
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 3;

  const grad = ctx.createRadialGradient(
    x - radius * .35, y - radius * .4, 1,
    x, y, radius * 1.2
  );
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(.3, COLORS[color]);
  grad.addColorStop(1, COLORS[color]);

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.shadowOffsetY = 0;

  // Motif garis permen.
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius - 1, 0, Math.PI * 2);
  ctx.clip();

  ctx.strokeStyle = "#ffffffaa";
  ctx.lineWidth = 4;

  for (let i = -radius * 2; i < radius * 2; i += 9) {
    ctx.beginPath();
    ctx.moveTo(x - radius, y + i);
    ctx.lineTo(x + radius, y + i - radius);
    ctx.stroke();
  }

  ctx.restore();

  ctx.beginPath();
  ctx.ellipse(
    x - radius * .28, y - radius * .4,
    radius * .22, radius * .12, -.5, 0, Math.PI * 2
  );
  ctx.fillStyle = "#ffffffcc";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x, y, radius - .5, 0, Math.PI * 2);
  ctx.strokeStyle = "#ffffff99";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.restore();
}

function drawBackground() {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#d9f5ff");
  grad.addColorStop(.65, "#fff0f8");
  grad.addColorStop(1, "#f8d8f0");

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Dekorasi kecil.
  for (let i = 0; i < 16; i++) {
    ctx.globalAlpha = .25;
    ctx.beginPath();
    ctx.arc((i * 83 + 17) % W, (i * 97 + 80) % 570, 3 + i % 4, 0, Math.PI * 2);
    ctx.fillStyle = COLORS[i % COLORS.length];
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Garis batas bawah.
  ctx.fillStyle = "#e6a9d8";
  ctx.fillRect(0, 580, W, 3);

  ctx.fillStyle = "#a96c9b";
  ctx.font = "bold 11px Trebuchet MS";
  ctx.textAlign = "center";
  ctx.fillText("CANDY ZONE", W / 2, 601);
}

function drawShooter() {
  // Alas penembak.
  ctx.beginPath();
  ctx.ellipse(shooter.x, shooter.y + 27, 36, 13, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#d5a9df";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(shooter.x, shooter.y, 27, 0, Math.PI * 2);
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.strokeStyle = "#f3a7d4";
  ctx.lineWidth = 4;
  ctx.stroke();

  // Garis bidikan.
  if (!projectile && !paused && !ended) {
    const dx = aim.x - shooter.x;
    const dy = aim.y - shooter.y;
    const len = Math.hypot(dx, dy) || 1;

    for (let i = 28; i < 180; i += 15) {
      const x = shooter.x + dx / len * i;
      const y = shooter.y + dy / len * i;
      if (y < 10) break;

      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = "#d18be0";
      ctx.fill();
    }
  }

  candy(
    projectile ? projectile.x : shooter.x,
    projectile ? projectile.y : shooter.y,
    projectile ? projectile.color : currentColor
  );

  ctx.font = "bold 11px Trebuchet MS";
  ctx.textAlign = "center";
  ctx.fillStyle = "#94689e";
  ctx.fillText("NEXT", 375, 645);
  candy(375, 664, nextColor, 12);
}

function drawOverlay() {
  if (!paused && !ended) return;

  ctx.fillStyle = "#58365d99";
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = "center";
  ctx.fillStyle = "#fff";
  ctx.font = "bold 32px Trebuchet MS";

  ctx.fillText(
    paused ? "PAUSED ⏸" : won ? "LEVEL CLEAR! 🎉" : "GAME OVER",
    W / 2, 315
  );

  ctx.font = "bold 17px Trebuchet MS";
  ctx.fillText(
    paused ? "Tekan RESUME untuk lanjut" :
    won ? "Level " + level + " berhasil!" :
    "Coba lagi, kamu pasti bisa!",
    W / 2, 350
  );

  if (won) {
    ctx.font = "bold 15px Trebuchet MS";
    ctx.fillText("Tekan NEXT LEVEL di bawah!", W / 2, 382);
  }
}

function draw() {
  drawBackground();

  bubbles.forEach(b => {
    const p = center(b);
    candy(p.x, p.y, b.color);
  });

  particles.forEach(p => {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.text ? "#ff9e29" : COLORS[p.color];

    if (p.text) {
      ctx.font = "bold 20px Trebuchet MS";
      ctx.textAlign = "center";
      ctx.fillText(p.text, p.x, p.y);
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  ctx.globalAlpha = 1;

  drawShooter();
  drawOverlay();
}

// ========== BIDIK DAN TEMBAK ==========

function setAim(e) {
  const rect = canvas.getBoundingClientRect();

  aim.x = (e.clientX - rect.left) * W / rect.width;
  aim.y = (e.clientY - rect.top) * H / rect.height;
  aim.y = Math.min(aim.y, shooter.y - 30);
}

canvas.addEventListener("pointermove", e => {
  setAim(e);
  draw();
});

canvas.addEventListener("pointerdown", e => {
  e.preventDefault();
  setAim(e);
  shoot();
});

$("shoot").addEventListener("click", shoot);

function shoot() {
  if (paused || ended || projectile || shotsLeft <= 0) return;

  let dx = aim.x - shooter.x;
  let dy = aim.y - shooter.y;
  const len = Math.hypot(dx, dy) || 1;

  dx /= len;
  dy /= len;

  if (dy > -.15) {
    dx = 0;
    dy = -1;
  }

  projectile = {
    x: shooter.x,
    y: shooter.y,
    vx: dx * 460,
    vy: dy * 460,
    color: currentColor
  };

  currentColor = nextColor;
  nextColor = randomColor();
  shotsLeft--;
  updateHUD();
}

// ========== KELOMPOK WARNA ==========

function findMatches(row, col, color) {
  const queue = [[row, col]];
  const seen = new Set();
  const result = [];

  while (queue.length) {
    const [r, c] = queue.shift();
    const k = r + "," + c;

    if (seen.has(k)) continue;
    seen.add(k);

    const b = findBubble(r, c);
    if (!b || b.color !== color) continue;

    result.push(b);

    neighbors(r, c).forEach(([nr, nc]) => {
      if (!seen.has(nr + "," + nc)) queue.push([nr, nc]);
    });
  }

  return result;
}

function findFloating() {
  const seen = new Set();
  const queue = [];

  bubbles.forEach(b => {
    if (b.row === 0) {
      queue.push(b);
      seen.add(b.row + "," + b.col);
    }
  });

  while (queue.length) {
    const b = queue.shift();

    neighbors(b.row, b.col).forEach(([r, c]) => {
      const k = r + "," + c;
      const other = findBubble(r, c);

      if (other && !seen.has(k)) {
        seen.add(k);
        queue.push(other);
      }
    });
  }

  const floating = bubbles.filter(
    b => !seen.has(b.row + "," + b.col)
  );

  bubbles = bubbles.filter(
    b => seen.has(b.row + "," + b.col)
  );

  floating.forEach(b => {
    const p = center(b);
    burst(p.x, p.y, b.color, 6);
    popped++;
    score += 20;
  });

  return floating.length;
}

function attachBubble() {
  if (!projectile) return;

  const p = projectile;
  let best = null;
  let distance = Infinity;

  // Tempatkan permen di posisi kosong terdekat.
  for (let row = 0; row < 25; row++) {
    for (let col = 0; col < COLS; col++) {
      if (findBubble(row, col)) continue;

      const x = cx(row, col);
      const y = cy(row);
      const d = Math.hypot(p.x - x, p.y - y);

      if (d < distance) {
        distance = d;
        best = { row, col, color: p.color };
      }
    }
  }

  projectile = null;
  if (!best) {
    finish(false);
    return;
  }

  bubbles.push(best);

  const matches = findMatches(best.row, best.col, best.color);

  if (matches.length >= 3) {
    const keys = new Set();

    matches.forEach(b => {
      keys.add(b.row + "," + b.col);
      const p = center(b);
      burst(p.x, p.y, b.color, 9);
      popped++;
      score += 15;
    });

    bubbles = bubbles.filter(
      b => !keys.has(b.row + "," + b.col)
    );

    const extra = findFloating();

    if (extra) {
      addText(W / 2, 280, "+" + extra * 20);
    }

    addText(cx(best.row, best.col), cy(best.row), "+" + matches.length * 15);
    $("message").textContent = "SWEET! +" + matches.length * 15 + " points 🍬";
  }

  updateHUD();

  if (popped >= target) {
    finish(true);
    return;
  }

  // Batas kekalahan.
  if (bubbles.some(b => cy(b.row) >= 565)) {
    finish(false);
    return;
  }

  if (shotsLeft <= 0) finish(popped >= target);
}

// ========== EFEK LEDAKAN ==========

function burst(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const speed = 40 + Math.random() * 130;

    particles.push({
      x, y, color,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      size: 2 + Math.random() * 4,
      life: .45 + Math.random() * .4,
      maxLife: .85
    });
  }
}

function addText(x, y, text) {
  particles.push({
    x, y, text,
    vx: 0, vy: -30,
    life: .9, maxLife: .9
  });
}

// ========== MENANG DAN KALAH ==========

function finish(success) {
  ended = true;
  won = success;

  if (success) {
    bestScore = Math.max(bestScore, score);
    $("message").textContent =
      "🎉 LEVEL " + level + " SELESAI! Tekan NEXT LEVEL!";
    $("shoot").textContent = "➡ NEXT LEVEL";
    $("shoot").onclick = () => startLevel(level + 1);
  } else {
    $("message").textContent = "💗 Game over! Tekan RESTART untuk coba lagi.";
    $("shoot").textContent = "🔄 TRY AGAIN";
    $("shoot").onclick = () => startLevel(level);
  }

  updateHUD();
  draw();
}

// ========== UPDATE ANIMASI ==========

function update(dt) {
  if (projectile) {
    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;

    // Pantulan dari dinding.
    if (projectile.x < R || projectile.x > W - R) {
      projectile.vx *= -1;
      projectile.x = Math.max(R, Math.min(W - R, projectile.x));
    }

    let hit = projectile.y <= TOP + R;

    if (!hit) {
      hit = bubbles.some(b => {
        const p = center(b);
        return Math.hypot(projectile.x - p.x, projectile.y - p.y) <= R * 2 - 1;
      });
    }

    if (hit) attachBubble();
  }

  particles.forEach(p => {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 65 * dt;
    p.life -= dt;
  });

  particles = particles.filter(p => p.life > 0);
}

function loop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000 || 0, .03);
  lastTime = timestamp;

  if (!paused && !ended) update(dt);

  draw();
  requestAnimationFrame(loop);
}

// ========== TOMBOL ==========

$("restart").addEventListener("click", () => {
  $("shoot").textContent = "🍭 SHOOT!";
  $("shoot").onclick = shoot;
  startLevel(level);
});

$("pause").addEventListener("click", () => {
  if (ended) return;

  paused = !paused;
  $("pause").textContent = paused ? "▶ RESUME" : "⏸ PAUSE";

  if (!paused) lastTime = performance.now();
  draw();
});

$("shoot").onclick = shoot;

// MULAI GAME
startLevel(1);
requestAnimationFrame(loop);