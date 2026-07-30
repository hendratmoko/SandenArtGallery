/*!
 * Tentacle Sync Cursor
 * Efek "tentakel" (spring/tail physics) mengikuti kursor.
 * Cara pakai: taruh file ini di server, lalu tambahkan sebelum </body>:
 *   <script src="tentacle-cursor.js"></script>
 * Tidak butuh elemen HTML tambahan — canvas dibuat & disuntikkan otomatis,
 * transparan, dan tidak menghalangi klik (pointer-events: none).
 */
(function () {
  // Jangan aktifkan di perangkat yang jelas-jelas tidak punya mouse (opsional, hemat baterai)
  // Hapus baris ini kalau tetap mau muncul di HP dengan gerakan idle.
  // if (window.matchMedia('(pointer: coarse)').matches) return;

  const canvas = document.createElement('canvas');
  canvas.id = 'tentacle-sync-cursor';
  Object.assign(canvas.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100vw',
    height: '100vh',
    pointerEvents: 'none',
    zIndex: '2147483647', // selalu di atas
    mixBlendMode: 'screen' // biar nyatu bagus di atas background terang/gelap
  });
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  let W, H, DPR;

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  const mouse = { x: W / 2, y: H / 2 };
  const head = { x: W / 2, y: H / 2 };
  let hasPointer = false;

  window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    hasPointer = true;
  });
  window.addEventListener('touchmove', (e) => {
    if (!e.touches.length) return;
    mouse.x = e.touches[0].clientX;
    mouse.y = e.touches[0].clientY;
    hasPointer = true;
  }, { passive: true });

  const TENTACLE_COUNT = 28;
  const SEGMENT_COUNT = 24;
  const SEGMENT_LENGTH = 6;

  function makeTentacle(index) {
    const angle = (index / TENTACLE_COUNT) * Math.PI * 2;
    const segments = [];
    for (let i = 0; i < SEGMENT_COUNT; i++) segments.push({ x: head.x, y: head.y });
    return {
      angle,
      phase: Math.random() * Math.PI * 2,
      speed: 0.10 + Math.random() * 0.14,
      wobbleAmp: 6 + Math.random() * 10,
      wobbleFreq: 0.6 + Math.random() * 1.1,
      hue: 200 + Math.random() * 40,
      segments
    };
  }

  const tentacles = Array.from({ length: TENTACLE_COUNT }, (_, i) => makeTentacle(i));
  let t = 0;

  function updateHead() {
    head.x += (mouse.x - head.x) * 0.18;
    head.y += (mouse.y - head.y) * 0.18;
  }

  function updateTentacle(tent) {
    const anchorX = head.x + Math.cos(tent.angle + t * 0.15) * 3;
    const anchorY = head.y + Math.sin(tent.angle + t * 0.15) * 3;

    const first = tent.segments[0];
    first.x += (anchorX - first.x) * tent.speed;
    first.y += (anchorY - first.y) * tent.speed;

    for (let i = 1; i < tent.segments.length; i++) {
      const prev = tent.segments[i - 1];
      const seg = tent.segments[i];
      const dx = prev.x - seg.x;
      const dy = prev.y - seg.y;
      const angle = Math.atan2(dy, dx);

      const wobble =
        Math.sin(t * tent.wobbleFreq + i * 0.35 + tent.phase) *
        tent.wobbleAmp * (i / tent.segments.length);
      const perpX = -Math.sin(angle);
      const perpY = Math.cos(angle);

      seg.x = prev.x - Math.cos(angle) * SEGMENT_LENGTH + perpX * wobble * 0.15;
      seg.y = prev.y - Math.sin(angle) * SEGMENT_LENGTH + perpY * wobble * 0.15;
    }
  }

  function drawTentacle(tent) {
    const segs = tent.segments;
    ctx.beginPath();
    ctx.moveTo(segs[0].x, segs[0].y);
    for (let i = 1; i < segs.length - 1; i++) {
      const xc = (segs[i].x + segs[i + 1].x) / 2;
      const yc = (segs[i].y + segs[i + 1].y) / 2;
      ctx.quadraticCurveTo(segs[i].x, segs[i].y, xc, yc);
    }
    ctx.strokeStyle = `hsla(${tent.hue}, 100%, 65%, 0.55)`;
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.shadowColor = `hsla(${tent.hue}, 100%, 60%, 0.9)`;
    ctx.shadowBlur = 8;
    ctx.stroke();
  }

  function drawHead() {
    const r = 8;
    const grad = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, r * 4);
    grad.addColorStop(0, 'rgba(140, 200, 255, 0.95)');
    grad.addColorStop(0.4, 'rgba(80, 160, 255, 0.35)');
    grad.addColorStop(1, 'rgba(80, 160, 255, 0)');
    ctx.beginPath();
    ctx.fillStyle = grad;
    ctx.arc(head.x, head.y, r * 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = '#bfe3ff';
    ctx.shadowColor = '#5fb2ff';
    ctx.shadowBlur = 20;
    ctx.arc(head.x, head.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  function frame() {
    t += 0.016;
    ctx.clearRect(0, 0, W, H);
    updateHead();
    for (const tent of tentacles) updateTentacle(tent);

    ctx.globalCompositeOperation = 'lighter';
    for (const tent of tentacles) drawTentacle(tent);
    ctx.globalCompositeOperation = 'source-over';

    drawHead();
    requestAnimationFrame(frame);
  }

  function idleDrift() {
    if (!hasPointer) {
      mouse.x = W / 2 + Math.cos(t * 0.5) * Math.min(W, H) * 0.18;
      mouse.y = H / 2 + Math.sin(t * 0.7) * Math.min(W, H) * 0.14;
    }
    requestAnimationFrame(idleDrift);
  }

  requestAnimationFrame(frame);
  requestAnimationFrame(idleDrift);
})();
