/* ===========================
   PARTICLE NETWORK CANVAS
=========================== */
(function() {
  const canvas = document.getElementById('net-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let W, H, particles, animId;
  const COUNT = 70;
  const MAX_DIST = 140;
  const COLORS = ['rgba(0,229,255,', 'rgba(155,93,229,', 'rgba(255,45,120,', 'rgba(6,214,160,'];

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function mkParticle() {
    return {
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.45,
      vy: (Math.random() - 0.5) * 0.45,
      r: Math.random() * 1.8 + 0.6,
      color: COLORS[Math.floor(Math.random() * COLORS.length)]
    };
  }

  function init() {
    resize();
    particles = Array.from({ length: COUNT }, mkParticle);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // Update + draw dots
    for (let i = 0; i < COUNT; i++) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color + '0.7)';
      ctx.fill();
    }

    // Draw connecting lines
    for (let i = 0; i < COUNT; i++) {
      for (let j = i + 1; j < COUNT; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < MAX_DIST) {
          const alpha = (1 - dist / MAX_DIST) * 0.35;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = particles[i].color + alpha + ')';
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }
    }

    animId = requestAnimationFrame(draw);
  }

  window.addEventListener('resize', () => {
    cancelAnimationFrame(animId);
    init();
    draw();
  });

  init();
  draw();
})();

/* ===========================
   LOGO BACKGROUND REMOVAL
   Flood-fills from all four edges to find
   connected white/near-white background pixels
   and makes them fully transparent.
=========================== */
function removeLogoBackground(imgEl) {
  // Must wait for the image to load
  const process = () => {
    const canvas = document.createElement('canvas');
    const ctx    = canvas.getContext('2d');
    const W = imgEl.naturalWidth  || imgEl.width;
    const H = imgEl.naturalHeight || imgEl.height;
    if (!W || !H) return;

    canvas.width  = W;
    canvas.height = H;
    ctx.drawImage(imgEl, 0, 0, W, H);

    let data;
    try {
      const id = ctx.getImageData(0, 0, W, H);
      data = id.data;

      // --- flood-fill from edges ---
      const visited = new Uint8Array(W * H);
      const queue   = [];

      const isBackground = (i) => {
        const r = data[i], g = data[i+1], b = data[i+2];
        // white / near-white tolerance
        return r > 220 && g > 220 && b > 220;
      };

      const enqueue = (x, y) => {
        if (x < 0 || y < 0 || x >= W || y >= H) return;
        const idx = y * W + x;
        if (visited[idx]) return;
        const pi = idx * 4;
        if (!isBackground(pi)) return;
        visited[idx] = 1;
        queue.push(idx);
      };

      // seed from all four edges
      for (let x = 0; x < W; x++) { enqueue(x, 0); enqueue(x, H-1); }
      for (let y = 0; y < H; y++) { enqueue(0, y); enqueue(W-1, y); }

      // BFS
      while (queue.length) {
        const idx = queue.pop();
        const x   = idx % W;
        const y   = (idx - x) / W;
        const pi  = idx * 4;
        data[pi+3] = 0;            // make transparent
        enqueue(x+1, y); enqueue(x-1, y);
        enqueue(x, y+1); enqueue(x, y-1);
      }

      // --- light edge feather pass ---
      // For pixels adjacent to transparent ones, soften slightly
      for (let y = 1; y < H-1; y++) {
        for (let x = 1; x < W-1; x++) {
          const pi = (y * W + x) * 4;
          if (data[pi+3] === 0) continue;
          const neighbors = [
            ((y-1)*W + x)*4, ((y+1)*W + x)*4,
            (y*W + x-1)*4,   (y*W + x+1)*4,
          ];
          const hasTransparentNeighbor = neighbors.some(n => data[n+3] === 0);
          if (hasTransparentNeighbor && isBackground(pi)) {
            data[pi+3] = 120; // semi-transparent edge pixel
          }
        }
      }

      ctx.putImageData(id, 0, 0);
      imgEl.src = canvas.toDataURL('image/png');
    } catch(e) {
      // CORS / tainted canvas — silently skip
      console.warn('Logo bg-removal skipped (CORS):', e.message);
    }
  };

  if (imgEl.complete && imgEl.naturalWidth) {
    process();
  } else {
    imgEl.addEventListener('load', process, { once: true });
  }
}

// Apply to all logo images on the page
window.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.nav-logo-img, .hero-logo-img, .footer-logo-img')
    .forEach(img => removeLogoBackground(img));
});

/* ===========================
   NAVBAR SCROLL + HAMBURGER
=========================== */
const navbar  = document.getElementById('navbar');
const hamburger = document.getElementById('hamburger');
const navLinks  = document.getElementById('nav-links');

window.addEventListener('scroll', () => {
  navbar.style.background = window.scrollY > 60
    ? 'rgba(18,16,30,0.97)'
    : 'rgba(18,16,30,0.85)';
});

hamburger.addEventListener('click', () => {
  navLinks.classList.toggle('open');
  const spans = hamburger.querySelectorAll('span');
  const open = navLinks.classList.contains('open');
  spans[0].style.transform = open ? 'rotate(45deg) translate(5px,6px)' : '';
  spans[1].style.opacity   = open ? '0' : '';
  spans[2].style.transform = open ? 'rotate(-45deg) translate(5px,-6px)' : '';
});

navLinks.querySelectorAll('a').forEach(a => {
  a.addEventListener('click', () => {
    navLinks.classList.remove('open');
    hamburger.querySelectorAll('span').forEach(s => {
      s.style.transform = '';
      s.style.opacity = '';
    });
  });
});

/* ===========================
   SCROLL REVEAL
=========================== */
const revealEls = document.querySelectorAll('.reveal');

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

revealEls.forEach(el => observer.observe(el));

/* ===========================
   HERO POP ANIMATION STAGGER
=========================== */
window.addEventListener('load', () => {
  const popEls = document.querySelectorAll('.hero .pop');
  popEls.forEach((el, i) => {
    el.style.animationDelay = `${i * 0.15}s`;
  });
});

/* ===========================
   BLOCKY LETTER WIGGLE
   Mouse on desktop, touch on mobile
=========================== */
const letters = document.querySelectorAll('.block-letter');
const isTouchDevice = () => window.matchMedia('(pointer: coarse)').matches;

letters.forEach(letter => {
  // Desktop hover
  letter.addEventListener('mouseenter', () => {
    if (isTouchDevice()) return;
    letter.style.transform = `rotate(${(Math.random() - 0.5) * 20}deg) scale(1.2)`;
    letter.style.transition = 'transform 0.2s cubic-bezier(0.34,1.56,0.64,1)';
  });
  letter.addEventListener('mouseleave', () => {
    if (isTouchDevice()) return;
    letter.style.transform = '';
    letter.style.transition = 'transform 0.3s ease';
  });

  // Mobile tap
  letter.addEventListener('touchstart', (e) => {
    e.preventDefault();
    letter.style.transform = `rotate(${(Math.random() - 0.5) * 18}deg) scale(1.25)`;
    letter.style.transition = 'transform 0.2s cubic-bezier(0.34,1.56,0.64,1)';
    setTimeout(() => {
      letter.style.transform = '';
      letter.style.transition = 'transform 0.35s ease';
    }, 500);
  }, { passive: false });
});

/* ===========================
   FEATURE CARD CLICK EFFECT
=========================== */
document.querySelectorAll('.feat-card').forEach(card => {
  card.addEventListener('click', () => {
    card.style.transform = 'translate(-6px,-6px) scale(0.97)';
    setTimeout(() => { card.style.transform = ''; }, 200);
  });
});

/* ===========================
   STEP BLOCK CLICK BOUNCE
=========================== */
document.querySelectorAll('.step-block').forEach(block => {
  block.addEventListener('click', () => {
    block.animate([
      { transform: 'translate(-3px,-3px) scale(0.96)' },
      { transform: 'translate(0,0) scale(1.03)' },
      { transform: 'translate(-3px,-3px) scale(1)' }
    ], { duration: 300, easing: 'ease-out' });
  });
});

/* ===========================
   FACT BLOCK COUNTER ANIMATION
=========================== */
const factNums = document.querySelectorAll('.fact-block .fact-num');

const countObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const el = entry.target;
    const text = el.textContent.trim();
    if (text === 'AI' || text === '2D' || text === 'Free') return;
    countObserver.unobserve(el);
  });
}, { threshold: 0.5 });

factNums.forEach(el => countObserver.observe(el));

/* ===========================
   SHAPE PARALLAX (desktop only)
=========================== */
const shapes = document.querySelectorAll('.shape');
if (!isTouchDevice()) {
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    shapes.forEach((s, i) => {
      const speed = (i % 3 === 0) ? 0.06 : (i % 3 === 1) ? 0.04 : 0.02;
      const dir   = i % 2 === 0 ? 1 : -1;
      s.style.transform = `translateY(${y * speed * dir}px)`;
    });
  }, { passive: true });
}

/* ===========================
   VIDEO — ensure autoplay works
=========================== */
const previewVid = document.querySelector('.preview-video');
if (previewVid) {
  previewVid.play().catch(() => {});
  // Reveal play on scroll into view
  const vidObserver = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) previewVid.play().catch(() => {});
      else previewVid.pause();
    });
  }, { threshold: 0.3 });
  vidObserver.observe(previewVid);
}

/* ===========================
   PHONE SCREEN GAME INTERACTION (kept for fallback)
=========================== */
const gameItems = document.querySelectorAll('.game-item');
gameItems.forEach(item => {
  item.addEventListener('click', () => {
    gameItems.forEach(g => g.classList.remove('selected'));
    item.classList.add('selected');
    item.animate([
      { transform: 'scale(0.9)' },
      { transform: 'scale(1.15)' },
      { transform: 'scale(1)' }
    ], { duration: 300, easing: 'cubic-bezier(0.34,1.56,0.64,1)' });
  });
});

/* ===========================
   ACTIVE NAV LINK ON SCROLL
=========================== */
const sections = document.querySelectorAll('section[id]');
const navAnchors = document.querySelectorAll('.nav-links a');

window.addEventListener('scroll', () => {
  let current = '';
  sections.forEach(s => {
    if (window.scrollY >= s.offsetTop - 120) current = s.id;
  });
  navAnchors.forEach(a => {
    a.style.color = a.getAttribute('href') === `#${current}` ? '#fff' : '';
  });
}, { passive: true });

/* ===========================
   LOGO BLOCK COLOR CYCLE
=========================== */
const colors = ['#00e5ff','#ffd60a','#ff2d78','#9b5de5','#06d6a0','#ff7f11'];
const logoBlocks = document.querySelectorAll('.logo-block');
let colorIdx = 0;

setInterval(() => {
  colorIdx = (colorIdx + 1) % colors.length;
  logoBlocks.forEach(lb => {
    lb.style.background = colors[colorIdx];
    lb.style.transition = 'background 0.5s ease';
  });
}, 1800);
