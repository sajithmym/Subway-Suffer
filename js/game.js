/* ============================================================
   SUBWAY SURFERS - Web Edition
   Complete Game Engine
   ============================================================ */

(() => {
'use strict';

// ────────────────────────────────────────────
//  CONFIGURATION
// ────────────────────────────────────────────
const CONFIG = {
    // Camera & Projection
    CAMERA_DEPTH: 140,
    HORIZON_RATIO: 0.32,
    GROUND_RATIO: 0.95,
    DRAW_DISTANCE: 280,

    // Road / Lanes
    LANE_COUNT: 3,
    ROAD_WIDTH_FACTOR: 0.24,
    UNIT_HEIGHT_FACTOR: 0.17,

    // Speed (world units per second)
    INITIAL_SPEED: 65,
    MAX_SPEED: 200,
    SPEED_INCREMENT: 0.4,

    // Player
    JUMP_HEIGHT: 2.4,
    JUMP_DURATION: 0.6,
    SLIDE_DURATION: 0.5,
    LANE_SWITCH_SPEED: 10,

    // Objects (world units)
    TRAIN_LENGTH_MIN: 8,
    TRAIN_LENGTH_MAX: 22,
    TRAIN_HEIGHT: 3.5,
    TRAIN_WIDTH: 0.72,
    BARRIER_HEIGHT: 0.9,
    BARRIER_HIGH_Y: 1.2,
    BARRIER_WIDTH: 0.9,

    // Collectibles
    COIN_HEIGHT: 1.2,
    COIN_RADIUS: 0.2,
    COIN_VALUE: 1,

    // Spawning
    SPAWN_AHEAD: 280,
    SPAWN_GAP_MIN: 28,
    SPAWN_GAP_MAX: 48,
    POWERUP_CHANCE: 0.06,

    // Power-up durations (seconds)
    MAGNET_DURATION: 8,
    MULTIPLIER_DURATION: 8,
    JETPACK_DURATION: 6,

    // Colors
    SKY_TOP: '#0a001a',
    SKY_MID: '#1a0a3a',
    SKY_BOTTOM: '#3a1a6a',
    GROUND_DARK: '#2a2a32',
    GROUND_LIGHT: '#32323a',
    RAIL_COLOR: '#7a7a88',
    TIE_COLOR: '#5a4a3a',
    TRAIN_COLORS: ['#e74c3c','#3498db','#2ecc71','#f39c12','#9b59b6','#e67e22','#1abc9c','#e84393'],
    BUILDING_COLORS: ['#1a1a2e','#16213e','#0f3460','#1a1a40','#2c2c54','#1e1e3f'],
    COIN_COLOR: '#ffd700',
    BARRIER_COLOR: '#e8b830',
};

// ────────────────────────────────────────────
//  CHARACTER DEFINITIONS
// ────────────────────────────────────────────
const CHARACTERS = [
    { id: 'jake',   name: 'Jake',   hoodie: '#3b82f6', cap: '#ef4444', skin: '#f5c6a0', pants: '#374151', shoes: '#ef4444' },
    { id: 'tricky', name: 'Tricky', hoodie: '#10b981', cap: '#fbbf24', skin: '#d4a574', pants: '#1f2937', shoes: '#fbbf24' },
    { id: 'fresh',  name: 'Fresh',  hoodie: '#8b5cf6', cap: '#ffffff', skin: '#8d6e4c', pants: '#111827', shoes: '#8b5cf6' },
    { id: 'spike',  name: 'Spike',  hoodie: '#ef4444', cap: '#111827', skin: '#f5c6a0', pants: '#1f2937', shoes: '#111827' },
];

// ────────────────────────────────────────────
//  UTILITY HELPERS
// ────────────────────────────────────────────
function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function rand(min, max) { return min + Math.random() * (max - min); }
function randInt(min, max) { return Math.floor(rand(min, max + 1)); }
function randChoice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function lightenColor(hex, amt) {
    let r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    r = Math.min(255, r + amt); g = Math.min(255, g + amt); b = Math.min(255, b + amt);
    return '#' + [r,g,b].map(c => c.toString(16).padStart(2,'0')).join('');
}
function darkenColor(hex, amt) { return lightenColor(hex, -amt); }

function boxesOverlap(a, b) {
    return a.x < b.x + b.width &&
           a.x + a.width > b.x &&
           a.y < b.y + b.height &&
           a.y + a.height > b.y &&
           a.z < b.z + b.depth &&
           a.z + a.depth > b.z;
}

// ────────────────────────────────────────────
//  AUDIO MANAGER
// ────────────────────────────────────────────
class AudioManager {
    constructor() {
        this.enabled = true;
        this.ctx = null;
    }

    init() {
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        } catch(e) { this.enabled = false; }
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    }

    tone(freq, dur, type = 'square', vol = 0.08) {
        if (!this.enabled || !this.ctx) return;
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
            gain.gain.setValueAtTime(vol, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + dur);
        } catch(e) {}
    }

    coin()    { this.tone(880,0.08,'sine',0.12); setTimeout(()=>this.tone(1320,0.08,'sine',0.08),40); }
    jump()    { this.tone(350,0.12,'sine',0.08); setTimeout(()=>this.tone(550,0.08,'sine',0.06),50); }
    slide()   { this.tone(180,0.18,'sawtooth',0.04); }
    crash()   { this.tone(90,0.5,'sawtooth',0.15); this.tone(70,0.6,'square',0.1); }
    swipe()   { this.tone(400,0.06,'sine',0.04); }
    powerUp() { [523,659,784,1047].forEach((f,i) => setTimeout(()=>this.tone(f,0.12,'sine',0.1), i*70)); }
}

// ────────────────────────────────────────────
//  PARTICLE SYSTEM
// ────────────────────────────────────────────
class Particle {
    constructor(x, y, vx, vy, color, life, size) {
        this.x = x; this.y = y;
        this.vx = vx; this.vy = vy;
        this.color = color;
        this.life = this.maxLife = life;
        this.size = size;
        this.active = true;
    }
    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.vy += 400 * dt;
        this.life -= dt;
        if (this.life <= 0) this.active = false;
    }
    draw(ctx) {
        const a = clamp(this.life / this.maxLife, 0, 1);
        ctx.globalAlpha = a;
        ctx.fillStyle = this.color;
        const s = this.size * (0.5 + 0.5 * a);
        ctx.fillRect(this.x - s/2, this.y - s/2, s, s);
        ctx.globalAlpha = 1;
    }
}

class ParticleSystem {
    constructor() { this.particles = []; }

    emit(x, y, count, color, spread = 120, life = 0.6, size = 4) {
        for (let i = 0; i < count; i++) {
            this.particles.push(new Particle(
                x, y,
                (Math.random()-0.5) * spread,
                (Math.random()-0.85) * spread,
                color,
                life + Math.random()*0.3,
                size + Math.random()*3
            ));
        }
    }

    update(dt) { this.particles = this.particles.filter(p => { p.update(dt); return p.active; }); }
    draw(ctx) { this.particles.forEach(p => p.draw(ctx)); }
    clear() { this.particles = []; }
}

// ────────────────────────────────────────────
//  PLAYER
// ────────────────────────────────────────────
class Player {
    constructor() { this.reset(); }

    reset() {
        this.lane = 1;
        this.targetLane = 1;
        this.x = 0;
        this.y = 0;
        this.jumping = false;
        this.sliding = false;
        this.jumpTime = 0;
        this.slideTime = 0;
        this.runFrame = 0;
        this.runTimer = 0;
        this.dead = false;

        // Power-ups
        this.hasMagnet = false;      this.magnetTime = 0;
        this.hasMultiplier = false;  this.multiplierTime = 0;
        this.hasJetpack = false;     this.jetpackTime = 0;
    }

    moveLeft()  { if (this.targetLane > 0) { this.targetLane--; return true; } return false; }
    moveRight() { if (this.targetLane < 2) { this.targetLane++; return true; } return false; }

    jump() {
        if (this.hasJetpack) return false;
        if (!this.jumping) {
            this.jumping = true;
            this.sliding = false;
            this.jumpTime = 0;
            return true;
        }
        return false;
    }

    slide() {
        if (this.hasJetpack) return false;
        if (this.jumping) {
            // Fast fall
            this.jumping = false;
            this.y = 0;
            this.sliding = true;
            this.slideTime = 0;
            return true;
        }
        if (!this.sliding) {
            this.sliding = true;
            this.slideTime = 0;
            return true;
        }
        return false;
    }

    update(dt) {
        // Smooth lane switching
        const targetX = this.targetLane - 1;
        const dx = targetX - this.x;
        if (Math.abs(dx) > 0.02) {
            this.x += Math.sign(dx) * CONFIG.LANE_SWITCH_SPEED * dt;
            if (Math.abs(this.x - targetX) < 0.05) this.x = targetX;
        } else {
            this.x = targetX;
        }
        this.lane = this.targetLane;

        // Jump
        if (this.jumping) {
            this.jumpTime += dt;
            const t = this.jumpTime / CONFIG.JUMP_DURATION;
            if (t >= 1) { this.jumping = false; this.y = 0; }
            else this.y = CONFIG.JUMP_HEIGHT * Math.sin(t * Math.PI);
        }

        // Jetpack
        if (this.hasJetpack) {
            this.jetpackTime -= dt;
            this.y = CONFIG.JUMP_HEIGHT * 1.8;
            this.jumping = false;
            this.sliding = false;
            if (this.jetpackTime <= 0) { this.hasJetpack = false; this.jumping = true; this.jumpTime = CONFIG.JUMP_DURATION * 0.5; }
        }

        // Slide
        if (this.sliding) {
            this.slideTime += dt;
            if (this.slideTime >= CONFIG.SLIDE_DURATION) { this.sliding = false; }
        }

        // Magnet
        if (this.hasMagnet) { this.magnetTime -= dt; if (this.magnetTime <= 0) this.hasMagnet = false; }
        // Multiplier
        if (this.hasMultiplier) { this.multiplierTime -= dt; if (this.multiplierTime <= 0) this.hasMultiplier = false; }

        // Run animation
        this.runTimer += dt;
        if (this.runTimer > 0.07) { this.runFrame = (this.runFrame + 1) % 8; this.runTimer = 0; }
    }

    getHitbox() {
        const w = 0.35;
        const h = this.sliding ? 0.6 : 1.7;
        const yBase = this.sliding ? 0 : 0;
        return { x: this.x - w/2, y: this.y + yBase, z: -0.5, width: w, height: h, depth: 1.0 };
    }
}

// ────────────────────────────────────────────
//  WORLD OBJECTS
// ────────────────────────────────────────────
class Train {
    constructor(lane, z, length, color) {
        this.lane = lane;
        this.x = lane - 1;
        this.z = z;
        this.length = length || rand(CONFIG.TRAIN_LENGTH_MIN, CONFIG.TRAIN_LENGTH_MAX);
        this.color = color || randChoice(CONFIG.TRAIN_COLORS);
        this.width = CONFIG.TRAIN_WIDTH;
        this.height = CONFIG.TRAIN_HEIGHT;
    }
    getHitbox() {
        return { x: this.x-this.width/2, y: 0, z: this.z, width: this.width, height: this.height, depth: this.length };
    }
}

class Barrier {
    constructor(lane, z, type) {
        this.lane = lane;
        this.x = lane - 1;
        this.z = z;
        this.type = type || 'low';
        this.width = CONFIG.BARRIER_WIDTH;
        this.height = this.type === 'low' ? CONFIG.BARRIER_HEIGHT : 2.8;
    }
    getHitbox() {
        if (this.type === 'high') {
            return { x: this.x-this.width/2, y: CONFIG.BARRIER_HIGH_Y, z: this.z, width: this.width, height: 1.6, depth: 0.8 };
        }
        return { x: this.x-this.width/2, y: 0, z: this.z, width: this.width, height: this.height, depth: 0.8 };
    }
}

class Coin {
    constructor(x, y, z) {
        this.x = x;
        this.y = y || CONFIG.COIN_HEIGHT;
        this.z = z;
        this.collected = false;
        this.bobPhase = Math.random() * Math.PI * 2;
    }
}

class PowerUp {
    constructor(lane, z, type) {
        this.lane = lane;
        this.x = lane - 1;
        this.y = 1.6;
        this.z = z;
        this.type = type; // 'magnet', 'multiplier', 'jetpack'
        this.collected = false;
        this.bobPhase = Math.random() * Math.PI * 2;
    }
}

// ────────────────────────────────────────────
//  WORLD GENERATOR
// ────────────────────────────────────────────
class WorldGenerator {
    constructor() { this.reset(); }

    reset() {
        this.trains = [];
        this.barriers = [];
        this.coins = [];
        this.powerups = [];
        this.nextSpawnZ = 60;
        this.difficulty = 1;
        this.totalDist = 0;
    }

    update(speed, dt) {
        const move = speed * dt;

        // Move everything toward player
        for (const t of this.trains)   t.z -= move;
        for (const b of this.barriers) b.z -= move;
        for (const c of this.coins)    c.z -= move;
        for (const p of this.powerups) p.z -= move;

        this.nextSpawnZ -= move;
        this.totalDist += move;
        this.difficulty = 1 + Math.floor(this.totalDist / 400) * 0.15;

        // Spawn new objects
        while (this.nextSpawnZ < CONFIG.SPAWN_AHEAD) {
            this.spawnPattern();
            const gap = rand(CONFIG.SPAWN_GAP_MIN, CONFIG.SPAWN_GAP_MAX) / Math.min(this.difficulty, 1.8);
            this.nextSpawnZ += gap;
        }

        this.cleanup();
    }

    spawnPattern() {
        const z = this.nextSpawnZ;
        const r = Math.random();

        if (r < 0.25) {
            // Single train
            const lane = randInt(0, 2);
            this.trains.push(new Train(lane, z));
            this.spawnCoinLine((lane + randInt(1,2)) % 3, z, z + 8);
        } else if (r < 0.45) {
            // Double train - leave one lane free
            const free = randInt(0, 2);
            for (let l = 0; l < 3; l++) {
                if (l !== free) this.trains.push(new Train(l, z, rand(8, 14)));
            }
            this.spawnCoinLine(free, z, z + 6);
        } else if (r < 0.6) {
            // Barrier row
            const free = randInt(0, 2);
            const type = Math.random() > 0.5 ? 'low' : 'high';
            for (let l = 0; l < 3; l++) {
                if (l !== free) this.barriers.push(new Barrier(l, z, type));
            }
            this.spawnCoinLine(free, z - 3, z + 3);
        } else if (r < 0.75) {
            // Train + barrier combo
            const tLane = randInt(0, 2);
            this.trains.push(new Train(tLane, z, rand(10, 16)));
            const bLane = (tLane + 1) % 3;
            this.barriers.push(new Barrier(bLane, z + rand(3, 6), Math.random()>0.5?'low':'high'));
            this.spawnCoinLine((tLane + 2) % 3, z, z + 8);
        } else if (r < 0.88) {
            // Staggered trains
            const l1 = randInt(0, 2);
            const l2 = (l1 + randInt(1,2)) % 3;
            this.trains.push(new Train(l1, z, rand(10, 18)));
            this.trains.push(new Train(l2, z + rand(15, 25), rand(10, 18)));
            // Coins between them
            const freeLane = [0,1,2].find(l => l !== l1 && l !== l2);
            if (freeLane !== undefined) this.spawnCoinLine(freeLane, z + 5, z + 15);
        } else {
            // Coin-rich segment - open path
            const lane = randInt(0, 2);
            this.spawnCoinArc(lane, z);
            if (Math.random() > 0.5) {
                const otherLane = (lane + randInt(1,2)) % 3;
                this.spawnCoinLine(otherLane, z, z + 10);
            }
        }

        // Random power-up
        if (Math.random() < CONFIG.POWERUP_CHANCE) {
            const types = ['magnet','multiplier','jetpack'];
            this.powerups.push(new PowerUp(randInt(0,2), z + rand(5, 15), randChoice(types)));
        }
    }

    spawnCoinLine(lane, startZ, endZ) {
        const x = lane - 1;
        for (let z = startZ; z <= endZ; z += 2.2) {
            this.coins.push(new Coin(x, CONFIG.COIN_HEIGHT, z));
        }
    }

    spawnCoinArc(lane, z) {
        const x = lane - 1;
        for (let i = 0; i < 7; i++) {
            const arcZ = z + i * 2;
            const arcY = CONFIG.COIN_HEIGHT + Math.sin(i / 6 * Math.PI) * 1.8;
            this.coins.push(new Coin(x, arcY, arcZ));
        }
    }

    cleanup() {
        this.trains   = this.trains.filter(t => t.z + t.length > -10);
        this.barriers = this.barriers.filter(b => b.z > -5);
        this.coins    = this.coins.filter(c => c.z > -5 && !c.collected);
        this.powerups = this.powerups.filter(p => p.z > -5 && !p.collected);
    }

    getSortedObjects() {
        const all = [];
        for (const t of this.trains)   all.push({ obj: t, sortZ: t.z + t.length/2, type: 'train' });
        for (const b of this.barriers) all.push({ obj: b, sortZ: b.z, type: 'barrier' });
        for (const c of this.coins)    if (!c.collected) all.push({ obj: c, sortZ: c.z, type: 'coin' });
        for (const p of this.powerups) if (!p.collected) all.push({ obj: p, sortZ: p.z, type: 'powerup' });
        all.sort((a, b) => b.sortZ - a.sortZ);
        return all;
    }
}

// ────────────────────────────────────────────
//  RENDERER
// ────────────────────────────────────────────
class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.resize();
    }

    resize() {
        const container = this.canvas.parentElement;
        this.w = container.clientWidth;
        this.h = container.clientHeight;
        this.canvas.width = this.w;
        this.canvas.height = this.h;

        this.cx = this.w / 2;
        this.horizonY = this.h * CONFIG.HORIZON_RATIO;
        this.groundY = this.h * CONFIG.GROUND_RATIO;
        this.roadHW = this.w * CONFIG.ROAD_WIDTH_FACTOR;
        this.unitH = this.h * CONFIG.UNIT_HEIGHT_FACTOR;
        this.camDepth = CONFIG.CAMERA_DEPTH;
    }

    project(wx, wy, wz) {
        if (wz < 0.1) wz = 0.1;
        const scale = this.camDepth / (wz + this.camDepth);
        return {
            x: this.cx + wx * scale * this.roadHW,
            y: this.horizonY + (this.groundY - this.horizonY) * scale - wy * scale * this.unitH,
            scale
        };
    }

    clear() {
        this.ctx.clearRect(0, 0, this.w, this.h);
    }

    // ---- SKY ----
    drawSky() {
        const ctx = this.ctx;
        const grad = ctx.createLinearGradient(0, 0, 0, this.horizonY + 50);
        grad.addColorStop(0, CONFIG.SKY_TOP);
        grad.addColorStop(0.5, CONFIG.SKY_MID);
        grad.addColorStop(1, CONFIG.SKY_BOTTOM);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, this.w, this.horizonY + 50);

        // Stars
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        const seed = 42;
        for (let i = 0; i < 40; i++) {
            const sx = ((seed * (i+1) * 7919) % 10000) / 10000 * this.w;
            const sy = ((seed * (i+1) * 6571) % 10000) / 10000 * (this.horizonY * 0.8);
            const ss = 0.5 + ((seed * (i+1) * 3571) % 10000) / 10000 * 1.5;
            ctx.fillRect(sx, sy, ss, ss);
        }

        // City silhouette on horizon
        ctx.fillStyle = '#0a0a15';
        const buildSeed = 123;
        for (let i = 0; i < 30; i++) {
            const bx = (i / 30) * this.w;
            const bw = this.w / 30 + 2;
            const bh = 15 + ((buildSeed * (i+1) * 4567) % 100) / 100 * 50;
            ctx.fillRect(bx, this.horizonY - bh + 20, bw + 1, bh + 20);
        }
    }

    // ---- GROUND ----
    drawGround(scrollOffset) {
        const ctx = this.ctx;

        // Fill ground
        const groundGrad = ctx.createLinearGradient(0, this.horizonY, 0, this.h);
        groundGrad.addColorStop(0, '#22222a');
        groundGrad.addColorStop(1, '#333340');
        ctx.fillStyle = groundGrad;
        ctx.fillRect(0, this.horizonY, this.w, this.h - this.horizonY);

        // Track bed (lighter center strip)
        for (let z = 0; z < CONFIG.DRAW_DISTANCE; z += 3) {
            const pL = this.project(-1.65, 0, z);
            const pR = this.project(1.65, 0, z);
            const pL2 = this.project(-1.65, 0, z + 3);
            const pR2 = this.project(1.65, 0, z + 3);

            ctx.fillStyle = 'rgba(60,55,70,0.4)';
            ctx.beginPath();
            ctx.moveTo(pL.x, pL.y);
            ctx.lineTo(pR.x, pR.y);
            ctx.lineTo(pR2.x, pR2.y);
            ctx.lineTo(pL2.x, pL2.y);
            ctx.closePath();
            ctx.fill();
        }

        // Cross-ties
        const tieSpacing = 2.5;
        const offset = ((scrollOffset % tieSpacing) + tieSpacing) % tieSpacing;
        for (let z = offset; z < CONFIG.DRAW_DISTANCE; z += tieSpacing) {
            const pL = this.project(-1.6, 0, z);
            const pR = this.project(1.6, 0, z);
            ctx.strokeStyle = 'rgba(90,75,60,0.35)';
            ctx.lineWidth = Math.max(1, pL.scale * 4);
            ctx.beginPath();
            ctx.moveTo(pL.x, pL.y);
            ctx.lineTo(pR.x, pR.y);
            ctx.stroke();
        }

        // Rail lines (2 per lane = 6 total)
        const railOffsets = [-1.15, -0.85, -0.15, 0.15, 0.85, 1.15];
        for (const rx of railOffsets) {
            ctx.beginPath();
            ctx.strokeStyle = CONFIG.RAIL_COLOR;
            ctx.lineWidth = 1.5;
            for (let z = 0; z < CONFIG.DRAW_DISTANCE; z += 4) {
                const p = this.project(rx, 0, z);
                if (z === 0) ctx.moveTo(p.x, p.y);
                else ctx.lineTo(p.x, p.y);
            }
            ctx.stroke();
        }

        // Lane dividers (subtle dashed)
        for (const lx of [-0.5, 0.5]) {
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(100,100,120,0.15)';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 8]);
            for (let z = 0; z < CONFIG.DRAW_DISTANCE; z += 5) {
                const p = this.project(lx, 0, z);
                if (z === 0) ctx.moveTo(p.x, p.y);
                else ctx.lineTo(p.x, p.y);
            }
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }

    // ---- SIDE BUILDINGS ----
    drawBuildings(scrollOffset) {
        const ctx = this.ctx;
        const buildingGap = 12;
        const offset = ((scrollOffset % buildingGap) + buildingGap) % buildingGap;

        for (let side = -1; side <= 1; side += 2) {
            for (let z = offset; z < CONFIG.DRAW_DISTANCE; z += buildingGap) {
                const bx = side * 2.6;
                const bw = 1.2;
                const bh = 2 + (((Math.floor(z/buildingGap) * 7919 + side * 3571) % 20) / 20) * 5;
                const color = CONFIG.BUILDING_COLORS[Math.abs(Math.floor(z/buildingGap) * 3 + side) % CONFIG.BUILDING_COLORS.length];

                const bl = this.project(bx - bw/2, 0, z);
                const br = this.project(bx + bw/2, 0, z);
                const tl = this.project(bx - bw/2, bh, z);
                const tr = this.project(bx + bw/2, bh, z);
                const bl2 = this.project(bx - bw/2, 0, z + buildingGap * 0.9);
                const tl2 = this.project(bx - bw/2, bh, z + buildingGap * 0.9);
                const br2 = this.project(bx + bw/2, 0, z + buildingGap * 0.9);
                const tr2 = this.project(bx + bw/2, bh, z + buildingGap * 0.9);

                // Front face
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.moveTo(bl.x, bl.y); ctx.lineTo(br.x, br.y);
                ctx.lineTo(tr.x, tr.y); ctx.lineTo(tl.x, tl.y);
                ctx.closePath(); ctx.fill();

                // Side face
                if (side === -1) {
                    ctx.fillStyle = darkenColor(color, 20);
                    ctx.beginPath();
                    ctx.moveTo(br.x, br.y); ctx.lineTo(br2.x, br2.y);
                    ctx.lineTo(tr2.x, tr2.y); ctx.lineTo(tr.x, tr.y);
                    ctx.closePath(); ctx.fill();
                } else {
                    ctx.fillStyle = darkenColor(color, 20);
                    ctx.beginPath();
                    ctx.moveTo(bl.x, bl.y); ctx.lineTo(bl2.x, bl2.y);
                    ctx.lineTo(tl2.x, tl2.y); ctx.lineTo(tl.x, tl.y);
                    ctx.closePath(); ctx.fill();
                }

                // Windows on front face
                const winRows = Math.floor(bh / 0.8);
                const winCols = 3;
                for (let wr = 0; wr < winRows; wr++) {
                    for (let wc = 0; wc < winCols; wc++) {
                        const wy = 0.4 + wr * 0.8;
                        const wx = bx - bw/2 + 0.15 + wc * (bw - 0.3) / winCols;
                        const wSize = 0.18;
                        const wp = this.project(wx + wSize/2, wy + wSize/2, z);
                        const s = wp.scale;
                        const winW = wSize * s * this.roadHW * 1.5;
                        const winH = wSize * s * this.unitH * 1.5;
                        if (winW > 0.5) {
                            const lit = ((wr * 7 + wc * 13 + Math.floor(z)) % 3) === 0;
                            ctx.fillStyle = lit ? 'rgba(255,220,100,0.6)' : 'rgba(20,20,40,0.5)';
                            ctx.fillRect(wp.x - winW/2, wp.y - winH/2, winW, winH);
                        }
                    }
                }
            }
        }
    }

    // ---- TRAIN ----
    drawTrain(train) {
        const ctx = this.ctx;
        const { x, z, length, width, height, color } = train;
        const hw = width / 2;

        // Clamp draw range
        const zStart = Math.max(z, 0.2);
        const zEnd = z + length;
        if (zEnd < 0.2 || zStart > CONFIG.DRAW_DISTANCE) return;

        // 8 corners
        const fbl = this.project(x - hw, 0, zStart);
        const fbr = this.project(x + hw, 0, zStart);
        const ftl = this.project(x - hw, height, zStart);
        const ftr = this.project(x + hw, height, zStart);
        const bbl = this.project(x - hw, 0, zEnd);
        const bbr = this.project(x + hw, 0, zEnd);
        const btl = this.project(x - hw, height, zEnd);
        const btr = this.project(x + hw, height, zEnd);

        // Top face
        ctx.fillStyle = lightenColor(color, 30);
        ctx.beginPath();
        ctx.moveTo(ftl.x, ftl.y); ctx.lineTo(ftr.x, ftr.y);
        ctx.lineTo(btr.x, btr.y); ctx.lineTo(btl.x, btl.y);
        ctx.closePath(); ctx.fill();

        // Left side
        ctx.fillStyle = darkenColor(color, 25);
        ctx.beginPath();
        ctx.moveTo(fbl.x, fbl.y); ctx.lineTo(bbl.x, bbl.y);
        ctx.lineTo(btl.x, btl.y); ctx.lineTo(ftl.x, ftl.y);
        ctx.closePath(); ctx.fill();

        // Right side
        ctx.fillStyle = darkenColor(color, 15);
        ctx.beginPath();
        ctx.moveTo(fbr.x, fbr.y); ctx.lineTo(bbr.x, bbr.y);
        ctx.lineTo(btr.x, btr.y); ctx.lineTo(ftr.x, ftr.y);
        ctx.closePath(); ctx.fill();

        // Front face (if visible)
        if (zStart < 40) {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(fbl.x, fbl.y); ctx.lineTo(fbr.x, fbr.y);
            ctx.lineTo(ftr.x, ftr.y); ctx.lineTo(ftl.x, ftl.y);
            ctx.closePath(); ctx.fill();

            // Front window
            const fwbl = this.project(x - hw * 0.6, height * 0.45, zStart);
            const fwbr = this.project(x + hw * 0.6, height * 0.45, zStart);
            const fwtl = this.project(x - hw * 0.6, height * 0.85, zStart);
            const fwtr = this.project(x + hw * 0.6, height * 0.85, zStart);
            ctx.fillStyle = 'rgba(150,200,255,0.4)';
            ctx.beginPath();
            ctx.moveTo(fwbl.x, fwbl.y); ctx.lineTo(fwbr.x, fwbr.y);
            ctx.lineTo(fwtr.x, fwtr.y); ctx.lineTo(fwtl.x, fwtl.y);
            ctx.closePath(); ctx.fill();
        }

        // Side windows
        const sideWindowSpacing = 3;
        for (let wz = zStart + 1; wz < zEnd - 1; wz += sideWindowSpacing) {
            if (wz > CONFIG.DRAW_DISTANCE) break;
            const winH1 = height * 0.4;
            const winH2 = height * 0.8;
            const winOffset = 0.1;

            // Left side windows
            const wl1 = this.project(x - hw - winOffset, winH1, wz);
            const wl2 = this.project(x - hw - winOffset, winH2, wz);
            const wl3 = this.project(x - hw - winOffset, winH2, wz + 1.5);
            const wl4 = this.project(x - hw - winOffset, winH1, wz + 1.5);

            ctx.fillStyle = 'rgba(130,180,240,0.3)';
            ctx.beginPath();
            ctx.moveTo(wl1.x, wl1.y); ctx.lineTo(wl2.x, wl2.y);
            ctx.lineTo(wl3.x, wl3.y); ctx.lineTo(wl4.x, wl4.y);
            ctx.closePath(); ctx.fill();

            // Right side windows
            const wr1 = this.project(x + hw + winOffset, winH1, wz);
            const wr2 = this.project(x + hw + winOffset, winH2, wz);
            const wr3 = this.project(x + hw + winOffset, winH2, wz + 1.5);
            const wr4 = this.project(x + hw + winOffset, winH1, wz + 1.5);

            ctx.beginPath();
            ctx.moveTo(wr1.x, wr1.y); ctx.lineTo(wr2.x, wr2.y);
            ctx.lineTo(wr3.x, wr3.y); ctx.lineTo(wr4.x, wr4.y);
            ctx.closePath(); ctx.fill();
        }

        // Stripe along the side
        const stripeY = height * 0.25;
        const sl1 = this.project(x - hw - 0.01, stripeY, zStart);
        const sl2 = this.project(x - hw - 0.01, stripeY + 0.15, zStart);
        const sl3 = this.project(x - hw - 0.01, stripeY + 0.15, zEnd);
        const sl4 = this.project(x - hw - 0.01, stripeY, zEnd);
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.beginPath();
        ctx.moveTo(sl1.x, sl1.y); ctx.lineTo(sl2.x, sl2.y);
        ctx.lineTo(sl3.x, sl3.y); ctx.lineTo(sl4.x, sl4.y);
        ctx.closePath(); ctx.fill();
    }

    // ---- BARRIER ----
    drawBarrier(barrier) {
        const ctx = this.ctx;
        const { x, z, width, height, type } = barrier;
        const hw = width / 2;
        const yBase = type === 'high' ? CONFIG.BARRIER_HIGH_Y : 0;
        const yTop = type === 'high' ? CONFIG.BARRIER_HIGH_Y + 2 : height;

        if (z < 0.2 || z > CONFIG.DRAW_DISTANCE) return;

        const bl = this.project(x - hw, yBase, z);
        const br = this.project(x + hw, yBase, z);
        const tl = this.project(x - hw, yTop, z);
        const tr = this.project(x + hw, yTop, z);
        const bl2 = this.project(x - hw, yBase, z + 0.6);
        const br2 = this.project(x + hw, yBase, z + 0.6);
        const tl2 = this.project(x - hw, yTop, z + 0.6);
        const tr2 = this.project(x + hw, yTop, z + 0.6);

        // Front face - yellow/black stripes
        const stripeCount = 5;
        for (let i = 0; i < stripeCount; i++) {
            const t1 = i / stripeCount;
            const t2 = (i + 1) / stripeCount;
            const y1 = yBase + (yTop - yBase) * t1;
            const y2 = yBase + (yTop - yBase) * t2;
            const p1l = this.project(x - hw, y1, z);
            const p1r = this.project(x + hw, y1, z);
            const p2l = this.project(x - hw, y2, z);
            const p2r = this.project(x + hw, y2, z);

            ctx.fillStyle = i % 2 === 0 ? CONFIG.BARRIER_COLOR : '#333';
            ctx.beginPath();
            ctx.moveTo(p1l.x, p1l.y); ctx.lineTo(p1r.x, p1r.y);
            ctx.lineTo(p2r.x, p2r.y); ctx.lineTo(p2l.x, p2l.y);
            ctx.closePath(); ctx.fill();
        }

        // Top face
        ctx.fillStyle = CONFIG.BARRIER_COLOR;
        ctx.beginPath();
        ctx.moveTo(tl.x, tl.y); ctx.lineTo(tr.x, tr.y);
        ctx.lineTo(tr2.x, tr2.y); ctx.lineTo(tl2.x, tl2.y);
        ctx.closePath(); ctx.fill();

        // Posts on sides
        if (type === 'high') {
            for (const px of [x - hw, x + hw]) {
                const postB = this.project(px, 0, z);
                const postT = this.project(px, yBase, z);
                ctx.strokeStyle = '#888';
                ctx.lineWidth = Math.max(1, postB.scale * 4);
                ctx.beginPath();
                ctx.moveTo(postB.x, postB.y);
                ctx.lineTo(postT.x, postT.y);
                ctx.stroke();
            }
        }
    }

    // ---- COIN ----
    drawCoin(coin, time) {
        const ctx = this.ctx;
        if (coin.z < 0.2 || coin.z > CONFIG.DRAW_DISTANCE || coin.collected) return;

        const bobY = coin.y + Math.sin(time * 3 + coin.bobPhase) * 0.15;
        const p = this.project(coin.x, bobY, coin.z);
        const r = Math.max(2, p.scale * CONFIG.COIN_RADIUS * this.roadHW * 0.8);

        // Spin effect
        const spinScale = Math.abs(Math.cos(time * 4 + coin.bobPhase));

        // Glow
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = r * 2;

        // Coin body
        ctx.fillStyle = CONFIG.COIN_COLOR;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, r * spinScale, r, 0, 0, Math.PI * 2);
        ctx.fill();

        // Shine
        if (spinScale > 0.3) {
            ctx.fillStyle = 'rgba(255,255,240,0.6)';
            ctx.beginPath();
            ctx.ellipse(p.x - r * 0.2 * spinScale, p.y - r * 0.2, r * 0.3 * spinScale, r * 0.3, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
    }

    // ---- POWER-UP ----
    drawPowerUp(powerup, time) {
        const ctx = this.ctx;
        if (powerup.z < 0.2 || powerup.z > CONFIG.DRAW_DISTANCE || powerup.collected) return;

        const bobY = powerup.y + Math.sin(time * 2 + powerup.bobPhase) * 0.25;
        const p = this.project(powerup.x, bobY, powerup.z);
        const r = Math.max(4, p.scale * 0.3 * this.roadHW);

        // Glow
        const glowColors = { magnet: '#ff4488', multiplier: '#44ff88', jetpack: '#4488ff' };
        const bodyColors = { magnet: '#e74c3c', multiplier: '#2ecc71', jetpack: '#3498db' };
        const icons = { magnet: '🧲', multiplier: '×2', jetpack: '🚀' };

        ctx.shadowColor = glowColors[powerup.type];
        ctx.shadowBlur = r * 3;

        // Body
        ctx.fillStyle = bodyColors[powerup.type];
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();

        // Inner ring
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 0.7, 0, Math.PI * 2);
        ctx.stroke();

        // Icon
        if (r > 6) {
            ctx.fillStyle = 'white';
            ctx.font = `bold ${Math.max(8, r)}px Poppins, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(icons[powerup.type], p.x, p.y);
        }

        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
    }

    // ---- PLAYER ----
    drawPlayer(player, character, time) {
        const ctx = this.ctx;
        const p = this.project(player.x, player.y, 2);
        const scale = p.scale * 1.1;
        const h = this.unitH * scale;
        const w = this.roadHW * 0.35 * scale;

        // Character colors
        const ch = character;
        const bodyH = player.sliding ? h * 0.3 : h * 0.5;
        const headR = w * 0.45;
        const frame = player.runFrame;
        const legSwing = player.sliding ? 0 : Math.sin(frame * Math.PI / 4) * 0.35;

        // Shadow on ground
        const shadowP = this.project(player.x, 0, 2);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(shadowP.x, shadowP.y, w * 0.7 * (1 + player.y * 0.1), w * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();

        // Invincibility flash
        if (player.hasJetpack && Math.floor(time * 8) % 2) {
            ctx.globalAlpha = 0.7;
        }

        const baseX = p.x;
        const baseY = p.y;

        if (player.sliding) {
            // ---- SLIDING POSE ----
            // Body horizontal
            const slideY = baseY;
            ctx.fillStyle = ch.hoodie;
            ctx.beginPath();
            const bodyW = h * 0.55;
            ctx.ellipse(baseX, slideY - bodyH * 0.3, bodyW, bodyH * 0.5, 0, 0, Math.PI * 2);
            ctx.fill();

            // Head
            ctx.fillStyle = ch.skin;
            ctx.beginPath();
            ctx.arc(baseX + bodyW * 0.7, slideY - bodyH * 0.3, headR * 0.7, 0, Math.PI * 2);
            ctx.fill();

            // Cap
            ctx.fillStyle = ch.cap;
            ctx.beginPath();
            ctx.arc(baseX + bodyW * 0.7, slideY - bodyH * 0.3 - headR * 0.3, headR * 0.7, Math.PI, 0);
            ctx.fill();
        } else {
            // ---- RUNNING / JUMPING POSE ----
            const bodyTop = baseY - bodyH;
            const bodyBot = baseY;

            // Legs
            const legLen = h * 0.35;
            for (let side = -1; side <= 1; side += 2) {
                const lSwing = side * legSwing * legLen;
                const legX = baseX + side * w * 0.15;

                // Thigh
                ctx.strokeStyle = ch.pants;
                ctx.lineWidth = w * 0.25;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(legX, bodyBot);
                ctx.lineTo(legX + lSwing * 0.5, bodyBot + legLen * 0.6);
                ctx.stroke();

                // Shin
                ctx.beginPath();
                ctx.moveTo(legX + lSwing * 0.5, bodyBot + legLen * 0.6);
                ctx.lineTo(legX + lSwing, bodyBot + legLen);
                ctx.stroke();

                // Shoe
                ctx.fillStyle = ch.shoes;
                ctx.beginPath();
                ctx.ellipse(legX + lSwing, bodyBot + legLen, w * 0.18, w * 0.1, 0, 0, Math.PI * 2);
                ctx.fill();
            }

            // Body (hoodie)
            ctx.fillStyle = ch.hoodie;
            const bRad = w * 0.4;
            roundRect(ctx, baseX - w * 0.35, bodyTop, w * 0.7, bodyH, bRad);
            ctx.fill();

            // Hoodie pocket
            ctx.fillStyle = darkenColor(ch.hoodie, 20);
            ctx.fillRect(baseX - w * 0.2, bodyBot - bodyH * 0.25, w * 0.4, bodyH * 0.15);

            // Arms
            const armLen = h * 0.3;
            for (let side = -1; side <= 1; side += 2) {
                const aSwing = -side * legSwing * armLen * 0.8;
                const armX = baseX + side * w * 0.38;
                const armY = bodyTop + bodyH * 0.15;

                ctx.strokeStyle = ch.hoodie;
                ctx.lineWidth = w * 0.2;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(armX, armY);
                ctx.lineTo(armX + side * w * 0.1, armY + armLen * 0.5 + aSwing * 0.3);
                ctx.stroke();

                // Hand
                ctx.fillStyle = ch.skin;
                ctx.beginPath();
                ctx.arc(armX + side * w * 0.1, armY + armLen * 0.5 + aSwing * 0.3, w * 0.08, 0, Math.PI * 2);
                ctx.fill();
            }

            // Head
            const headY = bodyTop - headR * 0.4;
            ctx.fillStyle = ch.skin;
            ctx.beginPath();
            ctx.arc(baseX, headY, headR, 0, Math.PI * 2);
            ctx.fill();

            // Eyes
            ctx.fillStyle = '#1a1a1a';
            ctx.beginPath();
            ctx.arc(baseX - headR * 0.25, headY - headR * 0.05, headR * 0.1, 0, Math.PI * 2);
            ctx.arc(baseX + headR * 0.25, headY - headR * 0.05, headR * 0.1, 0, Math.PI * 2);
            ctx.fill();

            // Smile
            ctx.strokeStyle = '#1a1a1a';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(baseX, headY + headR * 0.05, headR * 0.3, 0.1 * Math.PI, 0.9 * Math.PI);
            ctx.stroke();

            // Cap
            ctx.fillStyle = ch.cap;
            ctx.beginPath();
            ctx.ellipse(baseX, headY - headR * 0.5, headR * 1.15, headR * 0.45, 0, Math.PI, 0);
            ctx.fill();
            // Cap brim
            ctx.fillStyle = darkenColor(ch.cap, 30);
            ctx.beginPath();
            ctx.ellipse(baseX, headY - headR * 0.15, headR * 1.2, headR * 0.15, 0, Math.PI, 0);
            ctx.fill();
        }

        // Jetpack flames
        if (player.hasJetpack) {
            const flameX = baseX;
            const flameY = baseY + (player.sliding ? 0 : h * 0.15);
            for (let i = 0; i < 3; i++) {
                const fh = (10 + Math.random() * 15) * scale;
                const fw = (3 + Math.random() * 4) * scale;
                ctx.fillStyle = i === 0 ? '#ff4400' : (i === 1 ? '#ff8800' : '#ffcc00');
                ctx.beginPath();
                ctx.ellipse(flameX + (Math.random()-0.5) * w * 0.4, flameY + fh * 0.5, fw, fh * 0.5, 0, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Magnet aura
        if (player.hasMagnet) {
            ctx.strokeStyle = 'rgba(255,68,136,0.3)';
            ctx.lineWidth = 2;
            const aura = 1 + Math.sin(time * 5) * 0.2;
            ctx.beginPath();
            ctx.arc(baseX, baseY - bodyH * 0.5, w * 1.5 * aura, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.globalAlpha = 1;
    }

    // ---- NOTIFICATION TEXT ----
    drawNotification(text, time) {
        if (!text) return;
        const ctx = this.ctx;
        ctx.save();
        ctx.font = `bold ${Math.min(32, this.w * 0.065)}px Bangers, cursive`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffd700';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 8;
        const y = this.h * 0.45 - Math.sin(time * 3) * 5;
        ctx.fillText(text, this.cx, y);
        ctx.restore();
    }
}

// Helper: rounded rectangle
function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w/2, h/2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

// ────────────────────────────────────────────
//  INPUT HANDLER
// ────────────────────────────────────────────
class InputHandler {
    constructor(game) {
        this.game = game;
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.touchStartTime = 0;
        this.minSwipe = 30;
        this.setupKeyboard();
        this.setupTouch();
    }

    setupKeyboard() {
        document.addEventListener('keydown', (e) => {
            if (this.game.state !== 'playing') {
                if (e.key === 'Escape' && this.game.state === 'paused') {
                    this.game.resume();
                    e.preventDefault();
                }
                return;
            }

            switch(e.key) {
                case 'ArrowLeft': case 'a': case 'A':
                    if (this.game.player.moveLeft()) this.game.audio.swipe();
                    e.preventDefault(); break;
                case 'ArrowRight': case 'd': case 'D':
                    if (this.game.player.moveRight()) this.game.audio.swipe();
                    e.preventDefault(); break;
                case 'ArrowUp': case 'w': case 'W': case ' ':
                    if (this.game.player.jump()) this.game.audio.jump();
                    e.preventDefault(); break;
                case 'ArrowDown': case 's': case 'S':
                    if (this.game.player.slide()) this.game.audio.slide();
                    e.preventDefault(); break;
                case 'p': case 'P': case 'Escape':
                    this.game.pause();
                    e.preventDefault(); break;
            }
        });
    }

    setupTouch() {
        const el = this.game.canvas;

        el.addEventListener('touchstart', (e) => {
            if (this.game.state !== 'playing') return;
            const t = e.touches[0];
            this.touchStartX = t.clientX;
            this.touchStartY = t.clientY;
            this.touchStartTime = Date.now();
            e.preventDefault();
        }, { passive: false });

        el.addEventListener('touchend', (e) => {
            if (this.game.state !== 'playing') return;
            const t = e.changedTouches[0];
            const dx = t.clientX - this.touchStartX;
            const dy = t.clientY - this.touchStartY;
            const dt = Date.now() - this.touchStartTime;

            if (dt > 500) return; // Ignore slow touches

            const absDx = Math.abs(dx);
            const absDy = Math.abs(dy);

            if (absDx < this.minSwipe && absDy < this.minSwipe) return; // Tap, ignore

            if (absDx > absDy) {
                // Horizontal swipe
                if (dx > 0) { if (this.game.player.moveRight()) this.game.audio.swipe(); }
                else { if (this.game.player.moveLeft()) this.game.audio.swipe(); }
            } else {
                // Vertical swipe
                if (dy < 0) { if (this.game.player.jump()) this.game.audio.jump(); }
                else { if (this.game.player.slide()) this.game.audio.slide(); }
            }
            e.preventDefault();
        }, { passive: false });

        el.addEventListener('touchmove', (e) => { e.preventDefault(); }, { passive: false });
    }
}

// ────────────────────────────────────────────
//  MAIN GAME
// ────────────────────────────────────────────
class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.renderer = new Renderer(this.canvas);
        this.audio = new AudioManager();
        this.particles = new ParticleSystem();
        this.player = new Player();
        this.world = new WorldGenerator();
        this.input = null; // Set after init

        this.state = 'loading'; // loading, menu, playing, paused, gameover
        this.score = 0;
        this.coins = 0;
        this.distance = 0;
        this.speed = CONFIG.INITIAL_SPEED;
        this.scrollOffset = 0;
        this.time = 0;
        this.lastTime = 0;

        this.notification = '';
        this.notificationTimer = 0;

        // Persistence
        this.highScore = parseInt(localStorage.getItem('ss_highscore') || '0');
        this.totalCoins = parseInt(localStorage.getItem('ss_coins') || '0');
        this.selectedChar = localStorage.getItem('ss_char') || 'jake';
        this.soundEnabled = localStorage.getItem('ss_sound') !== 'false';
        this.firstGame = localStorage.getItem('ss_played') !== 'true';

        this.character = CHARACTERS.find(c => c.id === this.selectedChar) || CHARACTERS[0];
    }

    init() {
        this.audio.init();
        this.audio.enabled = this.soundEnabled;
        this.input = new InputHandler(this);

        window.addEventListener('resize', () => this.renderer.resize());
        this.renderer.resize();

        // Start game loop
        this.lastTime = performance.now();
        requestAnimationFrame((t) => this.gameLoop(t));
    }

    startGame() {
        this.audio.resume();
        this.state = 'playing';
        this.score = 0;
        this.coins = 0;
        this.distance = 0;
        this.speed = CONFIG.INITIAL_SPEED;
        this.scrollOffset = 0;
        this.notification = '';
        this.notificationTimer = 0;
        this.player.reset();
        this.world.reset();
        this.particles.clear();
        this.character = CHARACTERS.find(c => c.id === this.selectedChar) || CHARACTERS[0];

        if (this.firstGame) {
            this.firstGame = false;
            localStorage.setItem('ss_played', 'true');
        }
    }

    pause() {
        if (this.state === 'playing') {
            this.state = 'paused';
            ui.showScreen('pause-screen');
        }
    }

    resume() {
        if (this.state === 'paused') {
            this.state = 'playing';
            this.lastTime = performance.now();
            ui.showScreen('game-hud');
        }
    }

    gameOver() {
        this.state = 'gameover';
        this.audio.crash();

        // Screen shake effect
        this.shakeTime = 0.3;

        // Crash particles
        const pp = this.renderer.project(this.player.x, this.player.y + 1, 2);
        this.particles.emit(pp.x, pp.y, 25, '#ff4444', 200, 0.8, 5);
        this.particles.emit(pp.x, pp.y, 15, '#ffaa00', 150, 0.6, 4);

        // Update high score
        const isNewBest = this.score > this.highScore;
        if (isNewBest) {
            this.highScore = this.score;
            localStorage.setItem('ss_highscore', this.highScore.toString());
        }
        this.totalCoins += this.coins;
        localStorage.setItem('ss_coins', this.totalCoins.toString());

        // Show game over screen after a short delay
        setTimeout(() => {
            ui.showGameOver(this.score, this.coins, this.highScore, isNewBest);
        }, 800);
    }

    showNotification(text, duration = 2) {
        this.notification = text;
        this.notificationTimer = duration;
    }

    update(dt) {
        dt = Math.min(dt, 0.05); // Cap delta
        this.time += dt;

        // Speed increases over time
        this.speed = Math.min(CONFIG.MAX_SPEED, this.speed + CONFIG.SPEED_INCREMENT * dt);

        // Scroll
        this.scrollOffset += this.speed * dt;
        this.distance += this.speed * dt;

        // Score
        const mult = this.player.hasMultiplier ? 2 : 1;
        this.score += Math.floor(this.speed * dt * mult);

        // Screen shake
        if (this.shakeTime > 0) this.shakeTime -= dt;

        // Notification timer
        if (this.notificationTimer > 0) {
            this.notificationTimer -= dt;
            if (this.notificationTimer <= 0) this.notification = '';
        }

        // Update player
        this.player.update(dt);

        // Update world
        this.world.update(this.speed, dt);

        // Update particles
        this.particles.update(dt);

        // Check collisions
        this.checkCollisions();

        // Magnet effect
        if (this.player.hasMagnet) {
            this.magnetEffect();
        }

        // Update HUD
        ui.updateHUD(this.score, this.coins, this.player);
    }

    magnetEffect() {
        const magnetRange = 3;
        for (const coin of this.world.coins) {
            if (coin.collected) continue;
            const dx = Math.abs(coin.x - this.player.x);
            const dz = coin.z;
            if (dx < magnetRange && dz > 0 && dz < magnetRange * 2) {
                coin.x = lerp(coin.x, this.player.x, 0.15);
                coin.z = lerp(coin.z, 0, 0.1);
            }
        }
    }

    checkCollisions() {
        const pBox = this.player.getHitbox();

        // Coins
        for (const coin of this.world.coins) {
            if (coin.collected) continue;
            const dx = Math.abs(coin.x - this.player.x);
            const dy = Math.abs(coin.y - (this.player.y + 0.9));
            const dz = Math.abs(coin.z - 0.5);
            if (dx < 0.5 && dy < 0.8 && dz < 1.5) {
                coin.collected = true;
                this.coins += CONFIG.COIN_VALUE;
                this.audio.coin();
                const cp = this.renderer.project(coin.x, coin.y, coin.z);
                this.particles.emit(cp.x, cp.y, 6, CONFIG.COIN_COLOR, 80, 0.3, 3);
            }
        }

        // Power-ups
        for (const pu of this.world.powerups) {
            if (pu.collected) continue;
            const dx = Math.abs(pu.x - this.player.x);
            const dy = Math.abs(pu.y - (this.player.y + 1));
            const dz = Math.abs(pu.z - 0.5);
            if (dx < 0.5 && dy < 1.0 && dz < 1.5) {
                pu.collected = true;
                this.audio.powerUp();
                this.activatePowerUp(pu.type);
                const pp = this.renderer.project(pu.x, pu.y, pu.z);
                this.particles.emit(pp.x, pp.y, 15, '#ffffff', 120, 0.5, 4);
            }
        }

        // Obstacles (trains + barriers)
        if (this.player.dead || this.player.hasJetpack) return;

        for (const train of this.world.trains) {
            const tBox = train.getHitbox();
            if (boxesOverlap(pBox, tBox)) {
                this.player.dead = true;
                this.gameOver();
                return;
            }
        }

        for (const barrier of this.world.barriers) {
            const bBox = barrier.getHitbox();
            if (boxesOverlap(pBox, bBox)) {
                this.player.dead = true;
                this.gameOver();
                return;
            }
        }
    }

    activatePowerUp(type) {
        switch(type) {
            case 'magnet':
                this.player.hasMagnet = true;
                this.player.magnetTime = CONFIG.MAGNET_DURATION;
                this.showNotification('COIN MAGNET!');
                break;
            case 'multiplier':
                this.player.hasMultiplier = true;
                this.player.multiplierTime = CONFIG.MULTIPLIER_DURATION;
                this.showNotification('×2 SCORE!');
                break;
            case 'jetpack':
                this.player.hasJetpack = true;
                this.player.jetpackTime = CONFIG.JETPACK_DURATION;
                this.showNotification('JETPACK!');
                break;
        }
    }

    render() {
        const r = this.renderer;
        const ctx = r.ctx;

        // Screen shake
        if (this.shakeTime > 0) {
            const intensity = this.shakeTime * 15;
            ctx.save();
            ctx.translate((Math.random()-0.5)*intensity, (Math.random()-0.5)*intensity);
        }

        r.clear();
        r.drawSky();
        r.drawBuildings(this.scrollOffset);
        r.drawGround(this.scrollOffset);

        // Draw world objects (sorted far to near)
        const sorted = this.world.getSortedObjects();
        for (const item of sorted) {
            switch(item.type) {
                case 'train':   r.drawTrain(item.obj); break;
                case 'barrier': r.drawBarrier(item.obj); break;
                case 'coin':    r.drawCoin(item.obj, this.time); break;
                case 'powerup': r.drawPowerUp(item.obj, this.time); break;
            }
        }

        // Draw player (always at z=2 visually)
        if (!this.player.dead || this.shakeTime > 0) {
            r.drawPlayer(this.player, this.character, this.time);
        }

        // Particles
        this.particles.draw(ctx);

        // Notification
        if (this.notification) {
            r.drawNotification(this.notification, this.time);
        }

        if (this.shakeTime > 0) {
            ctx.restore();
        }
    }

    gameLoop(timestamp) {
        const dt = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;

        if (this.state === 'playing') {
            this.update(dt);
        }

        if (this.state === 'playing' || this.state === 'gameover') {
            this.render();
            if (this.state === 'gameover') {
                this.particles.update(dt);
            }
        }

        requestAnimationFrame((t) => this.gameLoop(t));
    }
}

// ────────────────────────────────────────────
//  UI CONTROLLER
// ────────────────────────────────────────────
class UIController {
    constructor(game) {
        this.game = game;
        this.screens = {};
        this.activeScreen = null;

        // Cache screen elements
        ['loading-screen', 'home-screen', 'char-screen', 'game-hud', 'pause-screen', 'gameover-screen'].forEach(id => {
            this.screens[id] = document.getElementById(id);
        });

        this.setupButtons();
        this.buildCharacterGrid();
    }

    showScreen(id) {
        // Hide all
        Object.values(this.screens).forEach(s => s.classList.remove('active'));
        // Show target
        if (this.screens[id]) {
            this.screens[id].classList.add('active');
            this.activeScreen = id;
        }
    }

    setupButtons() {
        // Play button
        document.getElementById('play-btn').addEventListener('click', () => {
            this.game.startGame();
            this.showScreen('game-hud');

            // Show tutorial for first game
            const tut = document.getElementById('swipe-tutorial');
            if (this.game.firstGame || !localStorage.getItem('ss_played')) {
                tut.style.display = 'flex';
                setTimeout(() => { tut.style.display = 'none'; }, 4500);
            } else {
                tut.style.display = 'none';
            }
        });

        // Characters button
        document.getElementById('chars-btn').addEventListener('click', () => {
            this.showScreen('char-screen');
            this.updateCharSelection();
        });

        // Character back button
        document.getElementById('char-back-btn').addEventListener('click', () => {
            this.showScreen('home-screen');
            this.drawCharPreview();
        });

        // Sound toggle
        const toggleSound = () => {
            this.game.soundEnabled = !this.game.soundEnabled;
            this.game.audio.enabled = this.game.soundEnabled;
            localStorage.setItem('ss_sound', this.game.soundEnabled.toString());
            this.updateSoundButtons();
        };
        document.getElementById('sound-btn').addEventListener('click', toggleSound);
        document.getElementById('pause-sound-btn').addEventListener('click', toggleSound);

        // Pause button
        document.getElementById('pause-btn').addEventListener('click', () => {
            this.game.pause();
        });

        // Resume button
        document.getElementById('resume-btn').addEventListener('click', () => {
            this.game.resume();
        });

        // Pause home button
        document.getElementById('pause-home-btn').addEventListener('click', () => {
            this.game.state = 'menu';
            this.showScreen('home-screen');
            this.updateHomeStats();
        });

        // Retry button
        document.getElementById('retry-btn').addEventListener('click', () => {
            this.game.startGame();
            this.showScreen('game-hud');
        });

        // Game over home button
        document.getElementById('go-home-btn').addEventListener('click', () => {
            this.game.state = 'menu';
            this.showScreen('home-screen');
            this.updateHomeStats();
        });
    }

    buildCharacterGrid() {
        const grid = document.getElementById('char-grid');
        grid.innerHTML = '';

        CHARACTERS.forEach(ch => {
            const card = document.createElement('div');
            card.className = 'char-card';
            card.dataset.charId = ch.id;

            const canvas = document.createElement('canvas');
            canvas.width = 80;
            canvas.height = 110;
            this.drawCharacterThumb(canvas, ch);

            const name = document.createElement('div');
            name.className = 'char-name';
            name.textContent = ch.name;

            card.appendChild(canvas);
            card.appendChild(name);

            card.addEventListener('click', () => {
                this.game.selectedChar = ch.id;
                this.game.character = ch;
                localStorage.setItem('ss_char', ch.id);
                this.updateCharSelection();
            });

            grid.appendChild(card);
        });
    }

    updateCharSelection() {
        document.querySelectorAll('.char-card').forEach(card => {
            card.classList.toggle('selected', card.dataset.charId === this.game.selectedChar);
        });
    }

    drawCharacterThumb(canvas, ch) {
        const ctx = canvas.getContext('2d');
        const cx = canvas.width / 2;
        const cy = canvas.height * 0.55;
        const scale = 0.9;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Body
        ctx.fillStyle = ch.hoodie;
        roundRect(ctx, cx - 18*scale, cy - 15*scale, 36*scale, 35*scale, 8*scale);
        ctx.fill();

        // Legs
        ctx.fillStyle = ch.pants;
        ctx.fillRect(cx - 12*scale, cy + 20*scale, 10*scale, 22*scale);
        ctx.fillRect(cx + 2*scale, cy + 20*scale, 10*scale, 22*scale);

        // Shoes
        ctx.fillStyle = ch.shoes;
        roundRect(ctx, cx - 14*scale, cy + 40*scale, 13*scale, 7*scale, 3*scale);
        ctx.fill();
        roundRect(ctx, cx + 1*scale, cy + 40*scale, 13*scale, 7*scale, 3*scale);
        ctx.fill();

        // Arms
        ctx.fillStyle = ch.hoodie;
        ctx.fillRect(cx - 24*scale, cy - 10*scale, 8*scale, 25*scale);
        ctx.fillRect(cx + 16*scale, cy - 10*scale, 8*scale, 25*scale);

        // Hands
        ctx.fillStyle = ch.skin;
        ctx.beginPath();
        ctx.arc(cx - 20*scale, cy + 17*scale, 5*scale, 0, Math.PI*2);
        ctx.arc(cx + 20*scale, cy + 17*scale, 5*scale, 0, Math.PI*2);
        ctx.fill();

        // Head
        ctx.fillStyle = ch.skin;
        ctx.beginPath();
        ctx.arc(cx, cy - 28*scale, 16*scale, 0, Math.PI*2);
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath();
        ctx.arc(cx - 5*scale, cy - 30*scale, 2.5*scale, 0, Math.PI*2);
        ctx.arc(cx + 5*scale, cy - 30*scale, 2.5*scale, 0, Math.PI*2);
        ctx.fill();

        // Smile
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy - 25*scale, 5*scale, 0.15*Math.PI, 0.85*Math.PI);
        ctx.stroke();

        // Cap
        ctx.fillStyle = ch.cap;
        ctx.beginPath();
        ctx.ellipse(cx, cy - 40*scale, 18*scale, 8*scale, 0, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = darkenColor(ch.cap, 30);
        ctx.beginPath();
        ctx.ellipse(cx, cy - 34*scale, 20*scale, 4*scale, 0, Math.PI, 0);
        ctx.fill();
    }

    drawCharPreview() {
        const canvas = document.getElementById('charPreviewCanvas');
        if (!canvas) return;
        const ch = this.game.character;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Larger version of character
        const cx = canvas.width / 2;
        const cy = canvas.height * 0.52;
        const s = 1.3;

        // Body
        ctx.fillStyle = ch.hoodie;
        roundRect(ctx, cx-22*s, cy-18*s, 44*s, 42*s, 10*s);
        ctx.fill();

        // Hoodie pocket
        ctx.fillStyle = darkenColor(ch.hoodie, 20);
        ctx.fillRect(cx-12*s, cy+14*s, 24*s, 8*s);

        // Legs
        ctx.fillStyle = ch.pants;
        roundRect(ctx, cx-15*s, cy+24*s, 13*s, 28*s, 4*s);
        ctx.fill();
        roundRect(ctx, cx+2*s, cy+24*s, 13*s, 28*s, 4*s);
        ctx.fill();

        // Shoes
        ctx.fillStyle = ch.shoes;
        roundRect(ctx, cx-17*s, cy+50*s, 16*s, 8*s, 4*s);
        ctx.fill();
        roundRect(ctx, cx+1*s, cy+50*s, 16*s, 8*s, 4*s);
        ctx.fill();

        // Arms
        ctx.fillStyle = ch.hoodie;
        roundRect(ctx, cx-30*s, cy-12*s, 10*s, 30*s, 5*s);
        ctx.fill();
        roundRect(ctx, cx+20*s, cy-12*s, 10*s, 30*s, 5*s);
        ctx.fill();

        // Hands
        ctx.fillStyle = ch.skin;
        ctx.beginPath();
        ctx.arc(cx-25*s, cy+20*s, 6*s, 0, Math.PI*2);
        ctx.arc(cx+25*s, cy+20*s, 6*s, 0, Math.PI*2);
        ctx.fill();

        // Head
        ctx.fillStyle = ch.skin;
        ctx.beginPath();
        ctx.arc(cx, cy-34*s, 20*s, 0, Math.PI*2);
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath();
        ctx.arc(cx-7*s, cy-36*s, 3*s, 0, Math.PI*2);
        ctx.arc(cx+7*s, cy-36*s, 3*s, 0, Math.PI*2);
        ctx.fill();

        // Eye shine
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(cx-6*s, cy-37*s, 1.2*s, 0, Math.PI*2);
        ctx.arc(cx+8*s, cy-37*s, 1.2*s, 0, Math.PI*2);
        ctx.fill();

        // Smile
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy-30*s, 7*s, 0.15*Math.PI, 0.85*Math.PI);
        ctx.stroke();

        // Cap
        ctx.fillStyle = ch.cap;
        ctx.beginPath();
        ctx.ellipse(cx, cy-50*s, 22*s, 10*s, 0, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = darkenColor(ch.cap, 30);
        ctx.beginPath();
        ctx.ellipse(cx, cy-42*s, 24*s, 5*s, 0, Math.PI, 0);
        ctx.fill();

        // Cap button
        ctx.fillStyle = ch.cap;
        ctx.beginPath();
        ctx.arc(cx, cy-52*s, 3*s, 0, Math.PI*2);
        ctx.fill();
    }

    updateSoundButtons() {
        const icon = this.game.soundEnabled ? '🔊' : '🔇';
        const i1 = document.getElementById('sound-icon');
        const i2 = document.getElementById('pause-sound-icon');
        if (i1) i1.textContent = icon;
        if (i2) i2.textContent = icon;
    }

    updateHomeStats() {
        document.getElementById('home-highscore').textContent = this.game.highScore.toLocaleString();
        document.getElementById('home-coins').textContent = this.game.totalCoins.toLocaleString();
        this.drawCharPreview();
    }

    updateHUD(score, coins, player) {
        document.getElementById('hud-score').textContent = score.toLocaleString();
        document.getElementById('hud-coins').textContent = coins.toLocaleString();

        // Multiplier
        const multEl = document.getElementById('hud-multiplier');
        if (player.hasMultiplier) {
            multEl.classList.remove('hidden');
        } else {
            multEl.classList.add('hidden');
        }

        // Power-up indicator
        const puInd = document.getElementById('powerup-indicator');
        const puIcon = document.getElementById('powerup-icon');
        const puName = document.getElementById('powerup-name');
        const puBar = document.getElementById('powerup-bar');

        let activePU = null;
        let puTime = 0;
        let puMax = 0;

        if (player.hasMagnet) { activePU = 'magnet'; puTime = player.magnetTime; puMax = CONFIG.MAGNET_DURATION; }
        else if (player.hasJetpack) { activePU = 'jetpack'; puTime = player.jetpackTime; puMax = CONFIG.JETPACK_DURATION; }
        else if (player.hasMultiplier) { activePU = 'multiplier'; puTime = player.multiplierTime; puMax = CONFIG.MULTIPLIER_DURATION; }

        if (activePU) {
            puInd.classList.remove('hidden');
            puInd.style.position = 'relative';
            const icons = { magnet: '🧲', multiplier: '×2', jetpack: '🚀' };
            const names = { magnet: 'Magnet', multiplier: 'Double', jetpack: 'Jetpack' };
            puIcon.textContent = icons[activePU];
            puName.textContent = names[activePU];
            puBar.style.width = (puTime / puMax * 100) + '%';
        } else {
            puInd.classList.add('hidden');
        }
    }

    showGameOver(score, coins, highScore, isNewBest) {
        document.getElementById('go-score').textContent = score.toLocaleString();
        document.getElementById('go-coins').textContent = coins.toLocaleString();
        document.getElementById('go-best').textContent = highScore.toLocaleString();

        const newBestEl = document.getElementById('new-best');
        if (isNewBest) newBestEl.classList.remove('hidden');
        else newBestEl.classList.add('hidden');

        this.showScreen('gameover-screen');
    }

    showLoading(progress) {
        const bar = document.getElementById('loading-bar');
        if (bar) bar.style.width = progress + '%';
    }
}

// ────────────────────────────────────────────
//  INITIALIZATION
// ────────────────────────────────────────────
let game, ui;

window.addEventListener('DOMContentLoaded', () => {
    game = new Game();
    ui = new UIController(game);
    game.init();

    // Simulated loading
    let progress = 0;
    const loadInterval = setInterval(() => {
        progress += randInt(8, 20);
        if (progress >= 100) {
            progress = 100;
            ui.showLoading(progress);
            clearInterval(loadInterval);
            setTimeout(() => {
                game.state = 'menu';
                ui.showScreen('home-screen');
                ui.updateHomeStats();
                ui.updateSoundButtons();
            }, 400);
        } else {
            ui.showLoading(progress);
        }
    }, 150);
});

})();
