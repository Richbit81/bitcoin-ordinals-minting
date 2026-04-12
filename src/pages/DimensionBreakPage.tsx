import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../contexts/WalletContext';
import { FeeRateSelector } from '../components/FeeRateSelector';
import { WalletConnect } from '../components/WalletConnect';
import { MintingProgress } from '../components/MintingProgress';
import { MintingStatus } from '../types/wallet';
import { logMinting } from '../services/mintingLog';
import { addMintPoints } from '../services/pointsService';
import {
  mintDimensionBreak,
  loadDimensionBreakCollection,
  loadMintCount as apiLoadMintCount,
  loadMintedIndices as apiLoadMintedIndices,
  loadAddressMintCount as apiLoadAddressMintCount,
  logDimensionBreakMint,
  updateDimensionBreakHashlist,
  loadRecentMints as apiLoadRecentMints,
  DimensionBreakCollection,
} from '../services/dimensionBreakMintService';
import { getOrdinalAddress } from '../utils/wallet';
import { useUnisatTaproot } from '../hooks/useUnisatTaproot';

const TOTAL_SUPPLY = 100;
const LIMIT_PER_ADDRESS = 1;

function DimensionCracksCanvas() {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const mouseRef = React.useRef({ x: -1, y: -1 });
  const rafRef = React.useRef(0);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    if (!ctx) return;

    let smx = -1, smy = -1, prevMx = -1, prevMy = -1, mouseSpeed = 0;

    type Vec = { x: number; y: number };
    type CrackSeg = Vec & { w: number };
    type Crack = { segs: CrackSeg[]; angle: number; maxLen: number; speed: number; branches: Crack[]; width: number; life: number; hue: number; growing: boolean };
    type Rift = { x: number; y: number; pts: Vec[]; size: number; pulse: number; hue: number; life: number; maxLife: number; rot: number; energy: number };
    type Shard = { x: number; y: number; vx: number; vy: number; rot: number; vr: number; size: number; hue: number; life: number; shape: Vec[]; alpha: number };
    type Spark = { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; hue: number; size: number };
    type Shockwave = { x: number; y: number; r: number; maxR: number; life: number; hue: number };

    const cracks: Crack[] = [];
    const rifts: Rift[] = [];
    const shards: Shard[] = [];
    const sparks: Spark[] = [];
    const shockwaves: Shockwave[] = [];

    const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);

    function makeRiftShape(cx: number, cy: number, size: number): Vec[] {
      const pts: Vec[] = [];
      const n = 7 + Math.floor(Math.random() * 6);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const r = size * (0.5 + Math.random() * 0.5);
        pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
      }
      return pts;
    }

    function makeShardShape(sz: number): Vec[] {
      const n = 3 + Math.floor(Math.random() * 3);
      const pts: Vec[] = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
        const r = sz * (0.4 + Math.random() * 0.6);
        pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
      }
      return pts;
    }

    function spawnCrack(x: number, y: number, angle?: number, width?: number) {
      if (cracks.length > 80) return;
      const w = width ?? 1.5 + Math.random() * 3;
      cracks.push({
        segs: [{ x, y, w }], angle: angle ?? Math.random() * Math.PI * 2,
        maxLen: 60 + Math.random() * 220, speed: 1.2 + Math.random() * 2.5,
        branches: [], width: w, life: 1, hue: 255 + Math.random() * 50, growing: true,
      });
    }

    function spawnRift(x: number, y: number, size?: number) {
      if (rifts.length > 18) return;
      const sz = size ?? 8 + Math.random() * 30;
      rifts.push({ x, y, pts: makeRiftShape(x, y, sz), size: sz, pulse: Math.random() * Math.PI * 2, hue: 260 + Math.random() * 60, life: 0, maxLife: 300 + Math.random() * 500, rot: (Math.random() - 0.5) * 0.003, energy: 0.5 + Math.random() * 0.5 });
    }

    function spawnShard(x: number, y: number, vx: number, vy: number) {
      if (shards.length > 60) return;
      const sz = 3 + Math.random() * 10;
      shards.push({ x, y, vx, vy, rot: Math.random() * Math.PI * 2, vr: (Math.random() - 0.5) * 0.08, size: sz, hue: 260 + Math.random() * 50, life: 1, shape: makeShardShape(sz), alpha: 0.4 + Math.random() * 0.4 });
    }

    function spawnSparks(x: number, y: number, count: number, hue: number) {
      for (let i = 0; i < count; i++) {
        if (sparks.length > 300) return;
        const a = Math.random() * Math.PI * 2;
        const spd = 0.5 + Math.random() * 3;
        sparks.push({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, life: 1, maxLife: 60 + Math.random() * 120, hue: hue + (Math.random() - 0.5) * 30, size: 1 + Math.random() * 2.5 });
      }
    }

    function spawnShockwave(x: number, y: number) {
      if (shockwaves.length > 6) return;
      shockwaves.push({ x, y, r: 0, maxR: 150 + Math.random() * 200, life: 1, hue: 265 + Math.random() * 30 });
    }

    const W = () => window.innerWidth;
    const H = () => window.innerHeight;

    for (let i = 0; i < 18; i++) spawnCrack(Math.random() * 2000, Math.random() * 2000);
    for (let i = 0; i < 6; i++) spawnRift(Math.random() * 2000, Math.random() * 2000);
    for (let i = 0; i < 10; i++) spawnShard(Math.random() * 2000, Math.random() * 2000, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3);

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = W() * dpr;
      canvas.height = H() * dpr;
      canvas.style.width = `${W()}px`;
      canvas.style.height = `${H()}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);
    const onMove = (e: MouseEvent) => { mouseRef.current = { x: e.clientX, y: e.clientY }; };
    const onLeave = () => { mouseRef.current = { x: -1, y: -1 }; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseleave', onLeave);

    let frame = 0;
    const draw = (ts: number) => {
      const t = ts * 0.001;
      const w = W(), h = H();
      const mx = mouseRef.current.x, my = mouseRef.current.y;
      const hasMouse = mx >= 0 && my >= 0;

      if (hasMouse) {
        smx = smx < 0 ? mx : smx + (mx - smx) * 0.1;
        smy = smy < 0 ? my : smy + (my - smy) * 0.1;
        if (prevMx >= 0) mouseSpeed = mouseSpeed * 0.85 + Math.hypot(mx - prevMx, my - prevMy) * 0.15;
        prevMx = mx; prevMy = my;
      } else { smx = -1; smy = -1; prevMx = -1; prevMy = -1; mouseSpeed *= 0.9; }

      ctx.clearRect(0, 0, w, h);
      frame++;

      const prox = (px: number, py: number, radius = 500) => {
        if (smx < 0) return 0;
        return Math.max(0, 1 - Math.hypot(px - smx, py - smy) / radius);
      };

      // --- Ambient dimensional fog ---
      for (let i = 0; i < 3; i++) {
        const fx = w * (0.2 + i * 0.3) + Math.sin(t * 0.3 + i * 2) * 80;
        const fy = h * (0.3 + i * 0.2) + Math.cos(t * 0.2 + i) * 60;
        const fr = 200 + Math.sin(t * 0.5 + i) * 60;
        const fg = ctx.createRadialGradient(fx, fy, 0, fx, fy, fr);
        const a = 0.025 + prox(fx, fy, 600) * 0.04;
        fg.addColorStop(0, `hsla(${270 + i * 20}, 70%, 40%, ${a})`);
        fg.addColorStop(1, 'transparent');
        ctx.fillStyle = fg;
        ctx.fillRect(fx - fr, fy - fr, fr * 2, fr * 2);
      }

      // --- Spawning logic ---
      if (frame % 60 === 0) spawnCrack(Math.random() * w, Math.random() * h);
      if (frame % 120 === 0) spawnRift(Math.random() * w, Math.random() * h);
      if (frame % 200 === 0) spawnShard(Math.random() * w, Math.random() * h, (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5);
      if (hasMouse) {
        if (frame % 10 === 0) {
          const ox = smx + (Math.random() - 0.5) * 250;
          const oy = smy + (Math.random() - 0.5) * 250;
          spawnCrack(ox, oy, Math.atan2(oy - smy, ox - smx) + (Math.random() - 0.5) * 0.6, 0.8 + Math.random() * 2);
        }
        if (frame % 40 === 0) spawnRift(smx + (Math.random() - 0.5) * 350, smy + (Math.random() - 0.5) * 350, 5 + Math.random() * 20);
        if (mouseSpeed > 5 && frame % 8 === 0) {
          spawnShard(smx, smy, (Math.random() - 0.5) * mouseSpeed * 0.3, (Math.random() - 0.5) * mouseSpeed * 0.3);
          spawnSparks(smx, smy, 2, 270);
        }
        if (mouseSpeed > 15 && frame % 30 === 0) spawnShockwave(smx, smy);
      }

      // --- Shockwaves ---
      for (let i = shockwaves.length - 1; i >= 0; i--) {
        const sw = shockwaves[i];
        sw.r += (sw.maxR - sw.r) * 0.06;
        sw.life -= 0.015;
        if (sw.life <= 0) { shockwaves.splice(i, 1); continue; }
        ctx.save();
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2);
        ctx.strokeStyle = `hsla(${sw.hue}, 80%, 70%, ${sw.life * 0.25})`;
        ctx.lineWidth = 2 + sw.life * 4;
        ctx.shadowColor = `hsla(${sw.hue}, 100%, 60%, ${sw.life * 0.4})`;
        ctx.shadowBlur = 20;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.r * 0.97, 0, Math.PI * 2);
        ctx.strokeStyle = `hsla(${sw.hue + 30}, 100%, 85%, ${sw.life * 0.15})`;
        ctx.lineWidth = 1;
        ctx.shadowBlur = 0;
        ctx.stroke();
        ctx.restore();
      }

      // --- Draw cracks (multi-layered) ---
      const growCrack = (c: Crack) => {
        const tip = c.segs[c.segs.length - 1];
        let p = prox(tip.x, tip.y);

        if (c.growing) {
          const totalLen = c.segs.length * 3;
          const growSpd = c.speed * (1 + p * 4);
          const steps = Math.ceil(growSpd);
          for (let s = 0; s < steps && totalLen + s * 3 < c.maxLen; s++) {
            const prev = c.segs[c.segs.length - 1];
            c.angle += (Math.random() - 0.5) * 0.3;
            const nx = prev.x + Math.cos(c.angle) * 3;
            const ny = prev.y + Math.sin(c.angle) * 3;
            const nw = c.width * (1 - (totalLen + s * 3) / c.maxLen * 0.7);
            c.segs.push({ x: nx, y: ny, w: Math.max(0.3, nw) });

            if (c.segs.length > 8 && c.branches.length < 4 && Math.random() < 0.025 * (1 + p * 5)) {
              const bAngle = c.angle + (Math.random() > 0.5 ? 1 : -1) * (0.4 + Math.random() * 0.8);
              const branch: Crack = { segs: [{ x: nx, y: ny, w: nw * 0.6 }], angle: bAngle, maxLen: c.maxLen * (0.2 + Math.random() * 0.35), speed: c.speed * 0.75, branches: [], width: nw * 0.6, life: 1, hue: c.hue + (Math.random() - 0.5) * 25, growing: true };
              c.branches.push(branch);
            }
          }
          if (c.segs.length * 3 >= c.maxLen) c.growing = false;
        } else {
          c.life -= 0.004 + (1 - p) * 0.002;
        }
        if (c.life <= 0) return false;

        p = prox(c.segs[0].x, c.segs[0].y);
        const baseA = c.life * (0.35 + p * 0.55);

        // Outer glow layer
        ctx.save();
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.shadowColor = `hsla(${c.hue}, 100%, 55%, ${baseA * 0.5})`;
        ctx.shadowBlur = 15 + p * 30;
        ctx.strokeStyle = `hsla(${c.hue}, 60%, 50%, ${baseA * 0.2})`;
        ctx.lineWidth = c.width * 4;
        ctx.beginPath();
        ctx.moveTo(c.segs[0].x, c.segs[0].y);
        for (let i = 1; i < c.segs.length; i++) ctx.lineTo(c.segs[i].x, c.segs[i].y);
        ctx.stroke();
        ctx.restore();

        // Mid layer
        ctx.save();
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.strokeStyle = `hsla(${c.hue}, 70%, 65%, ${baseA * 0.6})`;
        ctx.lineWidth = c.width * 1.5;
        ctx.shadowColor = `hsla(${c.hue + 15}, 90%, 70%, ${baseA * 0.3})`;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.moveTo(c.segs[0].x, c.segs[0].y);
        for (let i = 1; i < c.segs.length; i++) ctx.lineTo(c.segs[i].x, c.segs[i].y);
        ctx.stroke();
        ctx.restore();

        // Bright core
        ctx.save();
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.strokeStyle = `hsla(${c.hue + 30}, 100%, 90%, ${baseA * 0.8})`;
        ctx.lineWidth = Math.max(0.5, c.width * 0.4);
        ctx.beginPath();
        ctx.moveTo(c.segs[0].x, c.segs[0].y);
        for (let i = 1; i < c.segs.length; i++) ctx.lineTo(c.segs[i].x, c.segs[i].y);
        ctx.stroke();
        ctx.restore();

        // Sparks at tip while growing
        if (c.growing && Math.random() < 0.15) {
          const tipSeg = c.segs[c.segs.length - 1];
          spawnSparks(tipSeg.x, tipSeg.y, 1, c.hue);
        }

        for (let i = c.branches.length - 1; i >= 0; i--) {
          if (!growCrack(c.branches[i])) c.branches.splice(i, 1);
        }
        return c.life > 0;
      };

      for (let i = cracks.length - 1; i >= 0; i--) {
        if (!growCrack(cracks[i])) cracks.splice(i, 1);
      }

      // --- Dimensional rifts ---
      for (let i = rifts.length - 1; i >= 0; i--) {
        const r = rifts[i];
        r.life++;
        if (r.life > r.maxLife) { rifts.splice(i, 1); continue; }

        const p = prox(r.x, r.y, 450);
        const fadeIn = Math.min(1, r.life / 50);
        const fadeOut = Math.min(1, (r.maxLife - r.life) / 50);
        const alpha = fadeIn * fadeOut;
        const pulse = Math.sin(t * 2.5 + r.pulse) * 0.25 + 0.75;
        const sc = (1 + p * 1.8) * pulse;

        // Rotate rift points slowly
        for (const pt of r.pts) {
          const dx = pt.x - r.x, dy = pt.y - r.y;
          const a = Math.atan2(dy, dx) + r.rot;
          const d = Math.hypot(dx, dy);
          pt.x = r.x + Math.cos(a) * d;
          pt.y = r.y + Math.sin(a) * d;
        }

        ctx.save();

        // Deep void
        ctx.beginPath();
        const scaledPts = r.pts.map(pt => ({ x: r.x + (pt.x - r.x) * sc, y: r.y + (pt.y - r.y) * sc }));
        ctx.moveTo(scaledPts[0].x, scaledPts[0].y);
        for (let j = 1; j < scaledPts.length; j++) ctx.lineTo(scaledPts[j].x, scaledPts[j].y);
        ctx.closePath();
        ctx.fillStyle = `hsla(${r.hue}, 50%, 3%, ${alpha * (0.85 + p * 0.15)})`;
        ctx.fill();

        // Inner glow from another dimension
        const ig = ctx.createRadialGradient(r.x, r.y, 0, r.x, r.y, r.size * sc * 1.2);
        ig.addColorStop(0, `hsla(${r.hue + 40}, 100%, 60%, ${alpha * 0.35 * pulse * r.energy})`);
        ig.addColorStop(0.4, `hsla(${r.hue + 20}, 80%, 40%, ${alpha * 0.15 * pulse})`);
        ig.addColorStop(1, 'transparent');
        ctx.fillStyle = ig;
        ctx.fill();

        // Crackling edge
        ctx.shadowColor = `hsla(${r.hue}, 100%, 60%, ${alpha * 0.6})`;
        ctx.shadowBlur = 12 + p * 25;
        ctx.strokeStyle = `hsla(${r.hue}, 80%, 70%, ${alpha * (0.4 + p * 0.5) * pulse})`;
        ctx.lineWidth = 1.5 + p * 1.5;
        ctx.beginPath();
        ctx.moveTo(scaledPts[0].x, scaledPts[0].y);
        for (let j = 1; j < scaledPts.length; j++) {
          const mid = { x: (scaledPts[j].x + scaledPts[(j + 1) % scaledPts.length].x) / 2, y: (scaledPts[j].y + scaledPts[(j + 1) % scaledPts.length].y) / 2 };
          const jx = (Math.random() - 0.5) * 4 * (1 + p * 3);
          const jy = (Math.random() - 0.5) * 4 * (1 + p * 3);
          ctx.quadraticCurveTo(scaledPts[j].x + jx, scaledPts[j].y + jy, mid.x, mid.y);
        }
        ctx.closePath();
        ctx.stroke();

        // Bright inner edge
        ctx.shadowBlur = 0;
        ctx.strokeStyle = `hsla(${r.hue + 30}, 100%, 90%, ${alpha * 0.25 * pulse})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // Energy tendrils from rift
        if (p > 0.1 || Math.random() < 0.02) {
          const tendrilCount = Math.floor(1 + p * 4);
          for (let tt = 0; tt < tendrilCount; tt++) {
            const startPt = scaledPts[Math.floor(Math.random() * scaledPts.length)];
            const ta = Math.atan2(startPt.y - r.y, startPt.x - r.x) + (Math.random() - 0.5) * 1.5;
            const tLen = 15 + Math.random() * 40 * (1 + p * 2);
            ctx.beginPath();
            ctx.moveTo(startPt.x, startPt.y);
            let tx = startPt.x, ty = startPt.y;
            const steps = Math.floor(tLen / 5);
            for (let s = 0; s < steps; s++) {
              tx += Math.cos(ta + (Math.random() - 0.5) * 0.8) * 5;
              ty += Math.sin(ta + (Math.random() - 0.5) * 0.8) * 5;
              ctx.lineTo(tx, ty);
            }
            ctx.strokeStyle = `hsla(${r.hue + 20}, 90%, 70%, ${alpha * (0.1 + p * 0.3) * (1 - tt / tendrilCount)})`;
            ctx.lineWidth = 0.5 + Math.random();
            ctx.shadowColor = `hsla(${r.hue}, 100%, 60%, ${alpha * 0.2})`;
            ctx.shadowBlur = 6;
            ctx.stroke();
          }
        }

        // Leak sparks from rift
        if (Math.random() < 0.04 + p * 0.15) {
          const sp = scaledPts[Math.floor(Math.random() * scaledPts.length)];
          spawnSparks(sp.x, sp.y, 1 + Math.floor(p * 3), r.hue);
        }

        // Distortion rings when mouse is near
        if (p > 0.25) {
          const rc = 2 + Math.floor(p * 4);
          for (let rr = 0; rr < rc; rr++) {
            const radius = r.size * sc * (1.4 + rr * 0.4) + Math.sin(t * 4 + rr * 1.5) * 4;
            ctx.beginPath();
            ctx.arc(r.x, r.y, radius, 0, Math.PI * 2);
            ctx.strokeStyle = `hsla(${r.hue + rr * 15}, 70%, 60%, ${alpha * 0.06 * (1 - rr / rc)})`;
            ctx.lineWidth = 0.6;
            ctx.shadowBlur = 0;
            ctx.stroke();
          }
        }

        ctx.restore();
      }

      // --- Lightning arcs between nearby rifts ---
      for (let i = 0; i < rifts.length; i++) {
        for (let j = i + 1; j < rifts.length; j++) {
          const d = dist(rifts[i], rifts[j]);
          if (d < 300 && Math.random() < 0.008 + prox(rifts[i].x, rifts[i].y) * 0.03) {
            const a = rifts[i], b = rifts[j];
            ctx.save();
            ctx.strokeStyle = `hsla(${(a.hue + b.hue) / 2}, 90%, 75%, 0.15)`;
            ctx.lineWidth = 0.8;
            ctx.shadowColor = `hsla(${a.hue}, 100%, 70%, 0.3)`;
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            const segs = 6 + Math.floor(Math.random() * 6);
            for (let s = 1; s <= segs; s++) {
              const frac = s / segs;
              const lx = a.x + (b.x - a.x) * frac + (Math.random() - 0.5) * 40;
              const ly = a.y + (b.y - a.y) * frac + (Math.random() - 0.5) * 40;
              ctx.lineTo(lx, ly);
            }
            ctx.stroke();
            ctx.restore();
          }
        }
      }

      // --- Floating shards ---
      for (let i = shards.length - 1; i >= 0; i--) {
        const s = shards[i];
        const p = prox(s.x, s.y, 400);
        s.life -= 0.003 + (1 - p) * 0.001;
        if (s.life <= 0) { shards.splice(i, 1); continue; }

        if (smx >= 0) {
          const dx = s.x - smx, dy = s.y - smy;
          const d = Math.hypot(dx, dy);
          if (d < 200 && d > 0) {
            const force = (200 - d) / 200 * 0.15;
            s.vx += (dx / d) * force;
            s.vy += (dy / d) * force;
            s.vr += (Math.random() - 0.5) * 0.01 * force;
          }
        }

        s.x += s.vx; s.y += s.vy; s.rot += s.vr;
        s.vx *= 0.995; s.vy *= 0.995;

        const a = s.life * s.alpha;
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.rot);

        // Shard glow
        ctx.shadowColor = `hsla(${s.hue}, 80%, 60%, ${a * 0.5})`;
        ctx.shadowBlur = 8 + p * 12;
        ctx.fillStyle = `hsla(${s.hue}, 60%, 15%, ${a * 0.6})`;
        ctx.strokeStyle = `hsla(${s.hue}, 80%, 70%, ${a * (0.5 + p * 0.4)})`;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(s.shape[0].x, s.shape[0].y);
        for (let j = 1; j < s.shape.length; j++) ctx.lineTo(s.shape[j].x, s.shape[j].y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Inner reflection
        ctx.fillStyle = `hsla(${s.hue + 30}, 100%, 85%, ${a * 0.15})`;
        ctx.beginPath();
        const cx = s.shape.reduce((acc, p) => acc + p.x, 0) / s.shape.length;
        const cy = s.shape.reduce((acc, p) => acc + p.y, 0) / s.shape.length;
        ctx.arc(cx * 0.3, cy * 0.3, s.size * 0.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }

      // --- Sparks ---
      for (let i = sparks.length - 1; i >= 0; i--) {
        const sp = sparks[i];
        sp.life -= 1 / sp.maxLife;
        if (sp.life <= 0) { sparks.splice(i, 1); continue; }
        sp.x += sp.vx; sp.y += sp.vy;
        sp.vy += 0.01;
        sp.vx *= 0.99; sp.vy *= 0.99;
        const a = sp.life;

        ctx.save();
        ctx.shadowColor = `hsla(${sp.hue}, 100%, 70%, ${a * 0.6})`;
        ctx.shadowBlur = 4 + sp.size * 2;
        ctx.fillStyle = `hsla(${sp.hue}, 90%, 80%, ${a})`;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, sp.size * sp.life, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // --- Mouse cursor dimensional distortion ---
      if (hasMouse) {
        const intensity = Math.min(1, mouseSpeed / 30);
        const cursorR = 200 + intensity * 100;
        const cg = ctx.createRadialGradient(smx, smy, 0, smx, smy, cursorR);
        cg.addColorStop(0, `hsla(275, 80%, 55%, ${0.06 + intensity * 0.08})`);
        cg.addColorStop(0.3, `hsla(260, 70%, 45%, ${0.03 + intensity * 0.04})`);
        cg.addColorStop(0.6, `hsla(250, 60%, 35%, ${0.01 + intensity * 0.02})`);
        cg.addColorStop(1, 'transparent');
        ctx.fillStyle = cg;
        ctx.fillRect(smx - cursorR, smy - cursorR, cursorR * 2, cursorR * 2);

        // Pulsating ring
        const ringR = 30 + Math.sin(t * 3) * 8 + intensity * 20;
        ctx.beginPath();
        ctx.arc(smx, smy, ringR, 0, Math.PI * 2);
        ctx.strokeStyle = `hsla(270, 80%, 65%, ${0.08 + intensity * 0.15})`;
        ctx.lineWidth = 1;
        ctx.shadowColor = `hsla(270, 100%, 60%, ${0.15 + intensity * 0.2})`;
        ctx.shadowBlur = 15;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Thin inner ring
        ctx.beginPath();
        ctx.arc(smx, smy, ringR * 0.6, 0, Math.PI * 2);
        ctx.strokeStyle = `hsla(280, 100%, 80%, ${0.04 + intensity * 0.08})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none" style={{ zIndex: 2 }} />;
}

export const DimensionBreakPage: React.FC = () => {
  const navigate = useNavigate();
  const { walletState } = useWallet();
  const [collectionReady, setCollectionReady] = useState<boolean | null>(null);
  const [mintCount, setMintCount] = useState(0);
  const [inscriptionFeeRate, setInscriptionFeeRate] = useState<number>(1);
  const [mintingStatus, setMintingStatus] = useState<MintingStatus | null>(null);
  const [isMinting, setIsMinting] = useState(false);
  const [showWalletConnect, setShowWalletConnect] = useState(false);
  const [addressMintCount, setAddressMintCount] = useState<number>(0);
  const [mintedIndices, setMintedIndices] = useState<number[]>([]);
  const [collectionData, setCollectionData] = useState<DimensionBreakCollection | null>(null);
  const [lightbox, setLightbox] = useState<{ url: string; name: string } | null>(null);
  const { taprootOverride, handleTaprootChange, resolveReceiveAddress } = useUnisatTaproot();
  const [recentMints, setRecentMints] = useState<Array<{
    itemIndex: number | null;
    itemName: string;
    timestamp: string;
    walletAddress: string | null;
    inscriptionId: string | null;
    imageUrl: string | null;
  }>>([]);

  useEffect(() => {
    loadDimensionBreakCollection().then((col) => {
      if (col && col.generated.length > 0) {
        setCollectionReady(true);
        setCollectionData(col);
      } else {
        setCollectionReady(false);
      }
    });
    refreshMintCount();
    refreshMintedIndices();
    refreshRecentMints();
  }, []);

  useEffect(() => {
    if (walletState.connected && walletState.accounts[0]) {
      refreshAddressMintCount(getOrdinalAddress(walletState.accounts));
    } else {
      setAddressMintCount(0);
    }
  }, [walletState.connected, walletState.accounts]);

  const refreshMintCount = async () => {
    const count = await apiLoadMintCount();
    setMintCount(count);
  };

  const refreshMintedIndices = async () => {
    const indices = await apiLoadMintedIndices();
    setMintedIndices(indices);
  };

  const refreshAddressMintCount = async (address: string) => {
    const count = await apiLoadAddressMintCount(address);
    setAddressMintCount(count);
  };

  const refreshRecentMints = async () => {
    try {
      const recent = await apiLoadRecentMints();
      setRecentMints(recent.map(m => ({ ...m, imageUrl: null })));
    } catch { /* ignore */ }
  };

  const renderItemImage = useCallback(async (layerIds: string[], targetSize = 256): Promise<string | null> => {
    try {
      const images = await Promise.all(
        layerIds.map(id => new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error(`Failed to load ${id}`));
          img.src = `https://ordinals.com/content/${id}`;
        }))
      );
      const w = images[0]?.naturalWidth || 75;
      const h = images[0]?.naturalHeight || 75;
      const scale = Math.max(1, Math.ceil(targetSize / Math.max(w, h)));
      const canvas = document.createElement('canvas');
      canvas.width = w * scale;
      canvas.height = h * scale;
      const ctx = canvas.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      for (const img of images) {
        ctx.drawImage(img, 0, 0, w * scale, h * scale);
      }
      return canvas.toDataURL('image/png');
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!collectionData || recentMints.length === 0) return;
    if (recentMints.some(m => m.imageUrl !== null)) return;

    let cancelled = false;
    const renderAll = async () => {
      const updated = [...recentMints];
      for (let i = 0; i < updated.length; i++) {
        if (cancelled) return;
        const item = collectionData.generated.find((g) => g.index === updated[i].itemIndex);
        if (item && item.layers) {
          const layerIds = item.layers.map(l => l.trait.inscriptionId);
          const url = await renderItemImage(layerIds);
          updated[i] = { ...updated[i], imageUrl: url || 'placeholder' };
        } else if (updated[i].inscriptionId) {
          updated[i] = { ...updated[i], imageUrl: `https://ordinals.com/content/${updated[i].inscriptionId}` };
        } else {
          updated[i] = { ...updated[i], imageUrl: 'placeholder' };
        }
      }
      if (!cancelled) setRecentMints(updated);
    };
    renderAll();
    return () => { cancelled = true; };
  }, [collectionData, recentMints.length, renderItemImage]);

  const handleMint = useCallback(async () => {
    if (!walletState.connected || !walletState.accounts[0]) {
      setShowWalletConnect(true);
      return;
    }

    const { address: userAddress, error: taprootError } = await resolveReceiveAddress(walletState);
    if (taprootError) {
      setMintingStatus({ packId: 'dimension-break', status: 'failed', progress: 0, error: taprootError });
      return;
    }

    if (addressMintCount >= LIMIT_PER_ADDRESS) {
      setMintingStatus({
        packId: 'dimension-break',
        status: 'failed',
        progress: 0,
        error: `You have already minted ${addressMintCount} of ${LIMIT_PER_ADDRESS} allowed.\nOnly 1 per wallet.`,
      });
      return;
    }

    setIsMinting(true);
    setMintingStatus({ packId: 'dimension-break', status: 'processing', progress: 10 });

    try {
      let freshMintedIndices = mintedIndices;
      try {
        freshMintedIndices = await apiLoadMintedIndices();
        setMintedIndices(freshMintedIndices);
      } catch { /* fallback to cached */ }

      setMintingStatus({ packId: 'dimension-break', status: 'processing', progress: 30 });

      const result = await mintDimensionBreak(
        userAddress,
        inscriptionFeeRate,
        walletState.walletType || 'unisat',
        freshMintedIndices
      );

      console.log(`[DimensionBreak] Mint successful: ${result.inscriptionId}`);

      // 1) Collection-specific log
      try {
        await logDimensionBreakMint({
          walletAddress: userAddress,
          inscriptionId: result.inscriptionId,
          txid: result.txid || null,
          orderId: result.orderId || null,
          itemName: `Dimension Break #${result.item.index}`,
          itemIndex: result.item.index,
          paymentTxid: result.paymentTxid || null,
        });
      } catch (err) {
        console.warn('[DimensionBreak] Direct log failed:', err);
      }

      // 2) Generic backup log
      try {
        await logMinting({
          walletAddress: userAddress,
          packId: 'dimension-break',
          packName: 'Dimension Break',
          cards: [{
            id: `db-${result.item.index}`,
            name: `Dimension Break #${result.item.index}`,
            inscriptionId: result.inscriptionId,
            rarity: 'common',
          }],
          inscriptionIds: [result.inscriptionId],
          txids: result.txid ? [result.txid] : [],
          paymentTxid: result.paymentTxid,
          orderId: result.orderId,
        });
      } catch (err) {
        console.warn('[DimensionBreak] Backup log failed:', err);
      }

      // 3) Points
      try {
        await addMintPoints(userAddress, {
          collection: 'Dimension Break',
          itemName: `Dimension Break #${result.item.index}`,
          inscriptionId: result.inscriptionId,
          txid: result.txid || null,
          source: 'dimension-break-mint',
        });
      } catch { /* ignore */ }

      // 4) Hashlist
      try {
        await updateDimensionBreakHashlist({
          inscriptionId: result.inscriptionId,
          itemIndex: result.item.index,
          name: `Dimension Break #${result.item.index}`,
          attributes: result.item.layers.map(l => ({ trait_type: l.traitType, value: l.trait.name })),
        });
      } catch { /* ignore */ }

      setMintingStatus({
        packId: 'dimension-break',
        status: 'completed',
        progress: 100,
        inscriptionIds: [result.inscriptionId],
        paymentTxid: result.paymentTxid || undefined,
      });
      setMintCount(prev => prev + 1);
      setAddressMintCount(prev => prev + 1);
      setMintedIndices(prev => [...prev, result.item.index]);
      refreshRecentMints();
    } catch (error: any) {
      console.error('[DimensionBreak] Mint error:', error);
      setMintingStatus({
        packId: 'dimension-break',
        status: 'failed',
        progress: 0,
        error: error.message || 'Minting failed',
      });
    } finally {
      setIsMinting(false);
    }
  }, [walletState, inscriptionFeeRate, addressMintCount, mintedIndices]);

  const progressPercent = Math.min((mintCount / TOTAL_SUPPLY) * 100, 100);
  const isSoldOut = mintCount >= TOTAL_SUPPLY;
  const canMint = walletState.connected && !isSoldOut && !isMinting && addressMintCount < LIMIT_PER_ADDRESS;

  return (
    <div className="min-h-screen text-white relative overflow-hidden" style={{ background: '#050510' }}>
      {/* Blurred background image */}
      <div className="absolute inset-0" style={{
        backgroundImage: 'url(/images/dimension-break-bg.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        filter: 'blur(18px) brightness(0.35)',
        transform: 'scale(1.1)',
      }} />

      <DimensionCracksCanvas />

      <div className="relative z-10 container mx-auto px-4 py-6 min-h-screen flex flex-col">
        {/* Back */}
        <div className="mb-6">
          <button onClick={() => navigate('/')} className="text-gray-400 hover:text-purple-400 flex items-center gap-2 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="text-sm font-semibold">Back to Home</span>
          </button>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl md:text-7xl font-black tracking-wider mb-3" style={{
            background: 'linear-gradient(135deg, #a855f7, #6366f1, #ec4899)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 0 30px rgba(168,85,247,0.3))',
          }}>
            DIMENSION BREAK
          </h1>
          <p className="text-lg text-gray-400 italic">The dimensions are beginning to break.</p>
          <p className="text-sm text-gray-500 mt-1">{TOTAL_SUPPLY} Unique Recursive Pixel Ordinals on Bitcoin</p>
        </div>

        {collectionReady === null ? (
          <div className="text-center py-12 text-gray-400">Loading collection...</div>
        ) : collectionReady === false ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-4xl font-bold text-purple-400">COMING SOON</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-8 max-w-lg mx-auto w-full">
            {/* Preview Card */}
            <div className="w-full max-w-sm">
              <div className="relative rounded-2xl overflow-hidden border-2 border-purple-500/30 bg-black/60 backdrop-blur" style={{
                boxShadow: '0 0 40px rgba(168,85,247,0.15), 0 0 80px rgba(99,102,241,0.08)',
              }}>
                <img
                  src="/images/dimension-break-preview.gif"
                  alt="Dimension Break Preview"
                  className="w-full aspect-square object-cover"
                  style={{ imageRendering: 'pixelated' }}
                />
                {!isSoldOut && (
                  <div className="absolute top-3 right-3">
                    <span className="bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">FREE MINT</span>
                  </div>
                )}
                {isSoldOut && (
                  <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                    <span className="text-3xl font-black text-red-400">SOLD OUT</span>
                  </div>
                )}
              </div>
            </div>

            {/* Mint Info */}
            <div className="w-full bg-gray-900/80 backdrop-blur border border-gray-700/50 rounded-xl p-5 space-y-4">
              {/* Progress Bar */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">Minted</span>
                  <span className="text-purple-300 font-bold">{mintCount} / {TOTAL_SUPPLY}</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{
                    width: `${progressPercent}%`,
                    background: 'linear-gradient(90deg, #a855f7, #6366f1)',
                  }} />
                </div>
                <p className="text-xs text-gray-500 mt-1 text-center">{TOTAL_SUPPLY - mintCount} remaining</p>
              </div>

              {/* Price */}
              <div className="text-center py-2 rounded-lg bg-green-500/10 border border-green-500/20">
                <p className="text-2xl font-bold text-green-400">FREE</p>
                <p className="text-xs text-gray-400">Only inscription fees · 1 per wallet</p>
                {walletState.connected && (
                  <p className={`text-xs mt-1 font-bold ${addressMintCount >= LIMIT_PER_ADDRESS ? 'text-red-400' : 'text-green-400'}`}>
                    {addressMintCount} / {LIMIT_PER_ADDRESS} minted
                  </p>
                )}
              </div>

              {walletState.connected && walletState.walletType === 'unisat' && !walletState.accounts?.[0]?.address?.startsWith('bc1p') && (
                <div className="p-3 rounded-lg bg-gray-800/80 border border-orange-600/40">
                  <label className="block text-xs text-orange-300 mb-1 font-semibold">
                    Taproot-Adresse für Inscription-Empfang (bc1p...)
                  </label>
                  <input
                    type="text"
                    value={taprootOverride}
                    onChange={(e) => handleTaprootChange(e.target.value)}
                    placeholder="bc1p..."
                    className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-600 text-white text-sm font-mono placeholder-gray-500 focus:border-orange-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">
                    Kopiere deine Taproot-Adresse aus UniSat (Settings → Address Type → Taproot → Adresse kopieren).
                  </p>
                </div>
              )}

              {/* Fee Rate */}
              <div>
                <FeeRateSelector value={inscriptionFeeRate} onChange={setInscriptionFeeRate} />
              </div>

              {/* Mint Button */}
              {!walletState.connected ? (
                <button
                  onClick={() => setShowWalletConnect(true)}
                  className="w-full py-3 rounded-xl font-bold text-lg bg-purple-600 hover:bg-purple-500 transition-colors"
                >
                  Connect Wallet to Mint
                </button>
              ) : isSoldOut ? (
                <button disabled className="w-full py-3 rounded-xl font-bold text-lg bg-gray-700 text-gray-400 cursor-not-allowed">
                  SOLD OUT
                </button>
              ) : addressMintCount >= LIMIT_PER_ADDRESS ? (
                <button disabled className="w-full py-3 rounded-xl font-bold text-lg bg-gray-700 text-gray-400 cursor-not-allowed">
                  Already Minted (1 per wallet)
                </button>
              ) : (
                <button
                  onClick={handleMint}
                  disabled={!canMint}
                  className={`w-full py-3 rounded-xl font-bold text-lg transition-all ${
                    canMint
                      ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-lg shadow-purple-500/25'
                      : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {isMinting ? 'Minting...' : 'Mint for Free'}
                </button>
              )}

              {/* Minting Progress */}
              {mintingStatus && (
                <MintingProgress
                  status={mintingStatus}
                  onClose={() => setMintingStatus(null)}
                />
              )}
            </div>
          </div>
        )}

        {/* Recent Mints Banner */}
        {recentMints.length > 0 && (
          <div className="w-full mt-10 mb-6 max-w-2xl mx-auto">
            <h3 className="text-center text-xl font-bold mb-4" style={{
              background: 'linear-gradient(135deg, #a855f7, #6366f1)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              RECENT MINTS
            </h3>
            <div className="flex flex-wrap justify-center gap-3">
              {recentMints.map((mint, i) => (
                <div key={i} className="flex flex-col items-center group">
                  <div
                    className={`w-16 h-16 bg-black/60 border border-purple-500/30 rounded-lg overflow-hidden transition-transform group-hover:scale-110 ${
                      mint.imageUrl && mint.imageUrl !== 'placeholder' ? 'cursor-pointer' : ''
                    }`}
                    style={{ boxShadow: '0 0 12px rgba(168,85,247,0.15)' }}
                    onClick={async () => {
                      if (!mint.imageUrl || mint.imageUrl === 'placeholder') return;
                      setLightbox({ url: mint.imageUrl, name: mint.itemName });
                      if (!collectionData) return;
                      const item = collectionData.generated.find(g => g.index === mint.itemIndex);
                      if (item?.layers) {
                        const native = await renderItemImage(item.layers.map(l => l.trait.inscriptionId), 75);
                        if (native) setLightbox(prev => prev ? { ...prev, url: native } : null);
                      }
                    }}
                  >
                    {mint.imageUrl === 'placeholder' ? (
                      <div className="w-full h-full flex items-center justify-center bg-gray-900">
                        <span className="text-purple-400 font-bold text-xs">#{mint.itemIndex}</span>
                      </div>
                    ) : mint.imageUrl ? (
                      <img src={mint.imageUrl} alt={mint.itemName}
                        className="w-full h-full object-cover"
                        style={{ imageRendering: 'pixelated' }} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                  <p className="text-[9px] text-gray-500 mt-1 text-center">#{mint.itemIndex}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Wallet Connect Modal */}
      {showWalletConnect && (
        <WalletConnect onClose={() => setShowWalletConnect(false)} />
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm"
          onClick={() => setLightbox(null)}
        >
          <div className="relative" onClick={e => e.stopPropagation()}>
            <img
              src={lightbox.url}
              alt={lightbox.name}
              className="rounded-xl border-2 border-purple-500/40 block"
              style={{
                imageRendering: 'pixelated',
                width: 'min(80vmin, 600px)',
                height: 'min(80vmin, 600px)',
              }}
            />
            <p className="text-center text-purple-300 font-bold mt-3 text-lg">{lightbox.name}</p>
            <button
              onClick={() => setLightbox(null)}
              className="absolute -top-3 -right-3 w-8 h-8 bg-gray-800 border border-gray-600 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
