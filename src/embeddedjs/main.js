import Poco from "commodetto/Poco";
import Message from "pebble/message";
import Accelerometer from "embedded:sensor/Accelerometer";

const render = new Poco(screen);
const W = render.width;
const H = render.height;
const isRound = (W === H);   // gabbro 180x180; emery 200x228

const black   = render.makeColor(0, 0, 0);
const white   = render.makeColor(255, 255, 255);
const gray    = render.makeColor(120, 120, 120);
const lgray   = render.makeColor(200, 200, 200);
const dgray   = render.makeColor(60, 60, 60);
const moonBg  = render.makeColor(26, 26, 46);
const moonFg  = render.makeColor(255, 253, 220);

// Star colors (3 brightness levels)
const sBright = render.makeColor(255, 255, 255);
const sMed    = render.makeColor(190, 190, 210);
const sDim    = render.makeColor(110, 110, 140);

// Shooting star colors
const ssHead  = render.makeColor(255, 255, 255);
const ssMid   = render.makeColor(160, 160, 180);
const ssTail  = render.makeColor(70, 70, 90);

const fTime  = new render.Font(isRound ? "Bitham-Black" : "Roboto-Bold", isRound ? 36 : 49);
const fDate  = new render.Font("Gothic-Regular", 18);
const fPhase = new render.Font("Gothic-Bold", 18);
const fSm    = new render.Font("Gothic-Regular", 14);

const moonCX = W >> 1;
const moonCY = isRound ? 92 : 122;
const moonR  = isRound ? 45 : 48;

// ── Stars (daily seed, changes at 4 AM) ────────────────────────────────────
function getStarDay() {
    const now = new Date();
    // Before 4 AM counts as the previous calendar day
    const d = now.getHours() < 4 ? new Date(now.getTime() - 4 * 3600000) : now;
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

function generateStars() {
    let seed = (getStarDay() * 2654435761) >>> 0;
    if (seed === 0) seed = 1;
    function rand() {
        seed = ((seed * 1664525) + 1013904223) >>> 0;
        return seed / 0xFFFFFFFF;
    }

    const excludeR = moonR + 12;
    const out = [];
    let tries = 0;

    while (out.length < 18 && tries < 600) {
        tries++;
        const x = (rand() * (W - 4) + 2) | 0;
        const y = (rand() * (H - 4) + 2) | 0;
        const dx = x - moonCX, dy = y - moonCY;
        if (dx*dx + dy*dy < excludeR*excludeR) continue;

        const rv = rand();
        const size  = rv < 0.65 ? 1 : rv < 0.90 ? 2 : 3;
        const bv    = rand();
        const color = bv < 0.45 ? sBright : bv < 0.75 ? sMed : sDim;
        out.push({x, y, size, color});
    }
    return out;
}

let stars = generateStars();
let currentStarDay = getStarDay();

// ── Shooting star ──────────────────────────────────────────────────────────
const SS_DX = 7, SS_DY = 2;
const SS_NORM = Math.sqrt(SS_DX*SS_DX + SS_DY*SS_DY);
const SS_UX = SS_DX / SS_NORM;
const SS_UY = SS_DY / SS_NORM;

// Pre-computed tail segments: [{dist, size, color}]
const SS_SEGMENTS = [
    {dist:  0, sz: 2, color: ssHead},
    {dist:  5, sz: 2, color: ssHead},
    {dist:  9, sz: 2, color: ssMid },
    {dist: 14, sz: 1, color: ssMid },
    {dist: 18, sz: 1, color: ssTail},
    {dist: 22, sz: 1, color: ssTail},
];

let ssActive = false, ssX = 0, ssY = 0, ssTimer = null;

function startShootingStar() {
    if (ssActive) return;
    ssActive = true;
    ssX = -28;
    ssY = ((H * 0.18) + Math.random() * H * 0.5) | 0;
    if (ssTimer) { clearInterval(ssTimer); ssTimer = null; }
    ssTimer = setInterval(() => {
        ssX += SS_DX;
        ssY += SS_DY;
        if (ssX > W + 30) {
            clearInterval(ssTimer);
            ssTimer = null;
            ssActive = false;
        }
        draw();
    }, 45);
}

// ── Accelerometer — wrist flick triggers shooting star ─────────────────────
const accel = new Accelerometer({
    onTap() { startShootingStar(); }
});

// ── Weather ────────────────────────────────────────────────────────────────
let weather = { temp: null, code: -1, rise: -1, set: -1 };
let msg;
msg = new Message({
    keys: ["TEMP", "CODE", "RISE", "SET"],
    onReadable() {
        const map = msg.read();
        if (map.has("TEMP")) weather.temp = map.get("TEMP");
        if (map.has("CODE")) weather.code = map.get("CODE");
        if (map.has("RISE")) weather.rise = map.get("RISE");
        if (map.has("SET"))  weather.set  = map.get("SET");
        draw();
    }
});

// ── Helpers ────────────────────────────────────────────────────────────────
function getMoonPhase(date) {
    const ref   = new Date(Date.UTC(2000, 0, 6, 18, 14, 0));
    const cycle = 29.53058867;
    let phase   = ((date.getTime() - ref.getTime()) / 86400000 % cycle) / cycle;
    if (phase < 0) phase += 1;
    return phase;
}

function getPhaseName(phase) {
    if (phase < 0.0625 || phase >= 0.9375) return "New Moon";
    if (phase < 0.1875) return "Waxing Crescent";
    if (phase < 0.3125) return "First Quarter";
    if (phase < 0.4375) return "Waxing Gibbous";
    if (phase < 0.5625) return "Full Moon";
    if (phase < 0.6875) return "Waning Gibbous";
    if (phase < 0.8125) return "Last Quarter";
    return "Waning Crescent";
}

function getCondition(code) {
    if (code < 0)   return "";
    if (code === 0) return "Clear";
    if (code <= 2)  return "Partly Cloudy";
    if (code === 3) return "Overcast";
    if (code <= 48) return "Foggy";
    if (code <= 55) return "Drizzle";
    if (code <= 65) return "Rain";
    if (code <= 77) return "Snow";
    if (code <= 82) return "Showers";
    return "Thunder";
}

function minsToTime12(mins) {
    if (mins < 0) return "--:--";
    const h12 = Math.floor(mins / 60) % 12 || 12;
    const m   = mins % 60;
    return h12 + ":" + (m < 10 ? "0" : "") + m;
}

function cx(text, font) {
    return (W - render.getTextWidth(text, font)) >> 1;
}

// ── Drawing ────────────────────────────────────────────────────────────────
function drawStars() {
    for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        render.fillRectangle(s.color, s.x, s.y, s.size, s.size);
    }
}

function drawMoon(phase) {
    for (let dy = -moonR; dy <= moonR; dy++) {
        const chord = Math.sqrt(moonR * moonR - dy * dy) | 0;
        if (chord <= 0) continue;
        const y = moonCY + dy;
        render.fillRectangle(moonBg, moonCX - chord, y, chord * 2, 1);
        let x1, x2;
        if (phase < 0.5) {
            const tx = (Math.cos(phase * Math.PI * 2) * chord) | 0;
            x1 = tx; x2 = chord;
        } else {
            const tx = (Math.cos((phase - 0.5) * Math.PI * 2) * chord) | 0;
            x1 = -chord; x2 = tx;
        }
        if (x2 > x1) {
            const lx = moonCX + x1;
            const pw = moonCX + x2 - lx;
            if (pw > 0) render.fillRectangle(moonFg, lx, y, pw, 1);
        }
    }
    render.drawCircle(dgray, moonCX, moonCY, moonR, 0, 65536);
}

function drawShootingStar() {
    if (!ssActive) return;
    for (let i = 0; i < SS_SEGMENTS.length; i++) {
        const seg = SS_SEGMENTS[i];
        const px = (ssX - SS_UX * seg.dist) | 0;
        const py = (ssY - SS_UY * seg.dist) | 0;
        if (px < 0 || px >= W || py < 0 || py >= H) continue;
        render.fillRectangle(seg.color, px, py, seg.sz, seg.sz);
    }
}

function draw() {
    const now     = new Date();
    const phase   = getMoonPhase(now);
    const h12     = now.getHours() % 12 || 12;
    const min     = now.getMinutes();
    const timeStr = h12 + ":" + (min < 10 ? "0" : "") + min;

    const DAYS   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const dateStr = DAYS[now.getDay()] + " " + MONTHS[now.getMonth()] + " " + now.getDate();
    const pname   = getPhaseName(phase);

    render.begin();
    render.fillRectangle(black, 0, 0, W, H);

    drawStars();

    if (isRound) {
        // ── Gabbro 180×180 ──────────────────────────────────────────────────
        // Circle widths: y=139→~155px, y=155→~130px, y=164→~104px
        render.drawText(timeStr, fTime, white, cx(timeStr, fTime), 4);
        drawMoon(phase);
        render.drawText(pname, fPhase, lgray, cx(pname, fPhase), 139);
        if (weather.rise >= 0 && weather.set >= 0) {
            const rStr = "Sunrise " + minsToTime12(weather.rise);
            const sStr = "Sunset " + minsToTime12(weather.set);
            render.drawText(rStr, fSm, gray, 4, 150);
            render.drawText(sStr, fSm, gray, W - render.getTextWidth(sStr, fSm) - 4, 150);
        }
        if (weather.temp !== null) {
            const wStr = weather.temp + "\u00b0F" + (weather.code > 0 ? "  " + getCondition(weather.code) : "");
            render.drawText(wStr, fSm, gray, cx(wStr, fSm), 164);
        }
    } else {
        // ── Emery 200×228 ────────────────────────────────────────────────────
        render.drawText(timeStr, fTime, white, cx(timeStr, fTime), 2);
        render.drawText(dateStr, fDate, gray, cx(dateStr, fDate), 46);
        render.drawLine(20, 78, W - 20, 78, dgray, 1);
        drawMoon(phase);
        render.drawText(pname, fPhase, lgray, cx(pname, fPhase), 174);
        if (weather.temp !== null) {
            const cond = getCondition(weather.code);
            const wStr = weather.temp + "\u00b0F" + (cond ? "  " + cond : "");
            render.drawText(wStr, fSm, gray, cx(wStr, fSm), 194);
        }
        if (weather.rise >= 0 && weather.set >= 0) {
            const rStr = "Sunrise " + minsToTime12(weather.rise);
            const sStr = "Sunset " + minsToTime12(weather.set);
            render.drawText(rStr, fSm, gray, 6, 208);
            render.drawText(sStr, fSm, gray, W - render.getTextWidth(sStr, fSm) - 6, 208);
        }
    }

    drawShootingStar();

    render.end();
}

watch.addEventListener("minutechange", () => {
    const day = getStarDay();
    if (day !== currentStarDay) {
        currentStarDay = day;
        stars = generateStars();
    }
    draw();
});
draw();
