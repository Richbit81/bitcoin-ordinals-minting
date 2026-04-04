import React from 'react';

const FLOATING_PUPPETS = [
  'dj.png','pimp.png','pinkranger.png','boxlogo.png','billionaire.png',
  'checkmate.png','tigerstyle.png','runwaypup.png','pinkjourney.png',
  'puppetsindustries.png','mecha.png','kapital.png','kawsbunny.png',
  'jelly.png','holographic.png','ether.png','dog2.png','dog.png','genesis.png',
];

type Puppet = {
  src: string; x: number; y: number; size: number; baseSize: number;
  vx: number; vy: number; rot: number; vr: number;
  depth: number; breathPhase: number; breathSpeed: number;
  scrollFactor: number;
};

function initPuppets(count: number, w: number, h: number): Puppet[] {
  const shuffled = [...FLOATING_PUPPETS].sort(() => Math.random() - 0.5);
  const puppets: Puppet[] = [];
  for (let i = 0; i < count; i++) {
    const depth = 0.3 + Math.random() * 0.7;
    const baseSize = (80 + Math.random() * 100) * (0.6 + depth * 0.6);
    let x: number, y: number, tries = 0, overlaps: boolean;
    do {
      x = Math.random() * (w - baseSize);
      y = Math.random() * (h - baseSize);
      overlaps = puppets.some(p => {
        const dx = (x + baseSize / 2) - (p.x + p.baseSize / 2);
        const dy = (y + baseSize / 2) - (p.y + p.baseSize / 2);
        const minDist = (baseSize + p.baseSize) / 2;
        return dx * dx + dy * dy < minDist * minDist;
      });
      tries++;
    } while (overlaps && tries < 80);
    const speed = (0.06 + Math.random() * 0.1) * (0.5 + depth * 0.7);
    const angle = Math.random() * Math.PI * 2;
    puppets.push({
      src: `/images/pinkpuppets/${shuffled[i % shuffled.length]}`,
      x, y, size: baseSize, baseSize, depth,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      rot: 0,
      vr: (0.01 + Math.random() * 0.02) * (Math.random() < 0.5 ? 1 : -1),
      breathPhase: Math.random() * Math.PI * 2,
      breathSpeed: 0.001 + Math.random() * 0.001,
      scrollFactor: 0.15 + depth * 0.35,
    });
  }
  puppets.sort((a, b) => a.depth - b.depth);
  return puppets;
}

const MOUSE_RADIUS = 180;
const MOUSE_PUSH = 0.08;

export function FloatingPuppetsLayer() {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const puppetsRef = React.useRef<Puppet[]>([]);
  const [positions, setPositions] = React.useState<Puppet[]>([]);
  const rafRef = React.useRef<number>(0);
  const mouseRef = React.useRef<{ x: number; y: number; active: boolean }>({ x: 0, y: 0, active: false });
  const scrollRef = React.useRef(0);

  React.useEffect(() => {
    const onScroll = () => { scrollRef.current = window.scrollY; };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top, active: true };
    };
    const onLeave = () => { mouseRef.current.active = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseleave', onLeave);

    const w = el.clientWidth;
    const h = Math.min(el.clientHeight, window.innerHeight);
    if (w < 100 || h < 100) return;
    const area = w * h;
    const count = Math.max(5, Math.min(15, Math.round(area / 120000)));
    puppetsRef.current = initPuppets(count, w, h);
    setPositions([...puppetsRef.current]);

    let lastTime = performance.now();
    const step = (now: number) => {
      const dt = Math.min(now - lastTime, 50);
      lastTime = now;
      const ps = puppetsRef.current;
      const bw = el.clientWidth;
      const bh = el.clientHeight;
      const mouse = mouseRef.current;

      for (let i = 0; i < ps.length; i++) {
        ps[i].x += ps[i].vx * dt;
        ps[i].y += ps[i].vy * dt;
        ps[i].rot += ps[i].vr * dt;
        if (ps[i].rot > 15) { ps[i].rot = 15; ps[i].vr = -Math.abs(ps[i].vr); }
        if (ps[i].rot < -15) { ps[i].rot = -15; ps[i].vr = Math.abs(ps[i].vr); }

        ps[i].breathPhase += ps[i].breathSpeed * dt;
        ps[i].size = ps[i].baseSize * (1 + Math.sin(ps[i].breathPhase) * 0.03);

        if (mouse.active) {
          const cx = ps[i].x + ps[i].size / 2;
          const cy = ps[i].y + ps[i].size / 2;
          const mdx = cx - mouse.x;
          const mdy = cy - mouse.y;
          const mDist = Math.sqrt(mdx * mdx + mdy * mdy);
          if (mDist < MOUSE_RADIUS && mDist > 1) {
            const force = (1 - mDist / MOUSE_RADIUS) * MOUSE_PUSH;
            ps[i].vx += (mdx / mDist) * force;
            ps[i].vy += (mdy / mDist) * force;
          }
        }

        const r = ps[i].size / 2;
        if (ps[i].x < -r * 0.3) { ps[i].x = -r * 0.3; ps[i].vx = Math.abs(ps[i].vx); }
        if (ps[i].x + ps[i].size > bw + r * 0.3) { ps[i].x = bw + r * 0.3 - ps[i].size; ps[i].vx = -Math.abs(ps[i].vx); }
        if (ps[i].y < -r * 0.3) { ps[i].y = -r * 0.3; ps[i].vy = Math.abs(ps[i].vy); }
        if (ps[i].y + ps[i].size > bh + r * 0.3) { ps[i].y = bh + r * 0.3 - ps[i].size; ps[i].vy = -Math.abs(ps[i].vy); }

        const maxSpeed = 0.2;
        const spd = Math.sqrt(ps[i].vx * ps[i].vx + ps[i].vy * ps[i].vy);
        if (spd > maxSpeed) {
          ps[i].vx = (ps[i].vx / spd) * maxSpeed;
          ps[i].vy = (ps[i].vy / spd) * maxSpeed;
        }
      }

      for (let i = 0; i < ps.length; i++) {
        for (let j = i + 1; j < ps.length; j++) {
          const ax = ps[i].x + ps[i].size / 2, ay = ps[i].y + ps[i].size / 2;
          const bx = ps[j].x + ps[j].size / 2, by = ps[j].y + ps[j].size / 2;
          const dx = bx - ax, dy = by - ay;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const minDist = (ps[i].size + ps[j].size) / 2;
          if (dist < minDist && dist > 0.01) {
            const nx = dx / dist, ny = dy / dist;
            const overlap = (minDist - dist) / 2;
            ps[i].x -= nx * overlap * 0.3;
            ps[i].y -= ny * overlap * 0.3;
            ps[j].x += nx * overlap * 0.3;
            ps[j].y += ny * overlap * 0.3;
            const push = 0.02;
            ps[i].vx -= nx * push;
            ps[i].vy -= ny * push;
            ps[j].vx += nx * push;
            ps[j].vy += ny * push;
          }
        }
      }

      setPositions(ps.map(p => ({ ...p })));
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  const scroll = scrollRef.current;

  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 1 }}>
      <div style={{ position: 'absolute', inset: 0 }}>
        {positions.map((p, i) => {
          const opacity = 0.45 + p.depth * 0.4;
          const yOffset = -scroll * p.scrollFactor;
          return (
            <div
              key={i}
              className="absolute"
              style={{
                left: p.x,
                top: p.y + yOffset,
                width: p.size,
                opacity,
                transform: `rotate(${p.rot.toFixed(1)}deg)`,
                filter: `drop-shadow(0 4px ${6 + p.depth * 10}px rgba(219,39,119,${0.15 + p.depth * 0.15}))`,
                willChange: 'transform',
              }}
            >
              <img
                src={p.src}
                alt=""
                className="w-full h-auto"
                style={{
                  maskImage: 'linear-gradient(to bottom, black 85%, transparent 100%)',
                  WebkitMaskImage: 'linear-gradient(to bottom, black 85%, transparent 100%)',
                }}
                loading="lazy"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
