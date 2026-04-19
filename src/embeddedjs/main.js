import Poco from "commodetto/Poco";
import Message from "pebble/message";

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

const fTime  = new render.Font(isRound ? "Bitham-Black" : "Bitham-Bold", isRound ? 30 : 42);
const fDate  = new render.Font("Gothic-Regular", 18);
const fPhase = new render.Font("Gothic-Bold", 18);
const fSm    = new render.Font("Gothic-Regular", 14);

let weather = { temp: null, code: -1, rise: -1, set: -1 };

// onReadable must be at top level — nested inside "input" is wrong for this API
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

function getMoonPhase(date) {
    const ref   = new Date(Date.UTC(2000, 0, 6, 18, 14, 0));
    const cycle = 29.53058867;
    let phase   = ((date.getTime() - ref.getTime()) / 86400000 % cycle) / cycle;
    if (phase < 0) phase += 1;
    return phase;
}

function getPhaseName(phase) {
    if (phase < 0.0625 || phase >= 0.9375) return "New Moon";
    if (phase < 0.1875) return "Wax. Crescent";
    if (phase < 0.3125) return "First Quarter";
    if (phase < 0.4375) return "Wax. Gibbous";
    if (phase < 0.5625) return "Full Moon";
    if (phase < 0.6875) return "Wan. Gibbous";
    if (phase < 0.8125) return "Last Quarter";
    return "Wan. Crescent";
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

function drawMoon(mcx, mcy, r, phase) {
    for (let dy = -r; dy <= r; dy++) {
        const chord = Math.sqrt(r * r - dy * dy) | 0;
        if (chord <= 0) continue;
        const y = mcy + dy;
        render.fillRectangle(moonBg, mcx - chord, y, chord * 2, 1);
        let x1, x2;
        if (phase < 0.5) {
            const tx = (Math.cos(phase * Math.PI * 2) * chord) | 0;
            x1 = tx; x2 = chord;
        } else {
            const tx = (Math.cos((phase - 0.5) * Math.PI * 2) * chord) | 0;
            x1 = -chord; x2 = tx;
        }
        if (x2 > x1) {
            const lx = mcx + x1;
            const pw = mcx + x2 - lx;
            if (pw > 0) render.fillRectangle(moonFg, lx, y, pw, 1);
        }
    }
    render.drawCircle(dgray, mcx, mcy, r, 0, 65536);
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

    if (isRound) {
        // ── Gabbro 180×180 ──────────────────────────────────────────────────
        render.drawText(timeStr, fTime, white, cx(timeStr, fTime), 4);
        drawMoon(W >> 1, 92, 45, phase);
        render.drawText(pname, fPhase, lgray, cx(pname, fPhase), 142);
        if (weather.temp !== null) {
            const wStr = weather.temp + "\u00b0F" + (weather.code > 0 ? "  " + getCondition(weather.code) : "");
            render.drawText(wStr, fSm, gray, cx(wStr, fSm), 162);
        }
    } else {
        // ── Emery 200×228 ────────────────────────────────────────────────────
        render.drawText(timeStr, fTime, white, cx(timeStr, fTime), 2);
        render.drawText(dateStr, fDate, gray, cx(dateStr, fDate), 48);
        render.drawLine(20, 70, W - 20, 70, dgray, 1);
        drawMoon(W >> 1, 122, 48, phase);
        render.drawText(pname, fPhase, lgray, cx(pname, fPhase), 174);
        if (weather.temp !== null) {
            const cond = getCondition(weather.code);
            const wStr = weather.temp + "\u00b0F" + (cond ? "  " + cond : "");
            render.drawText(wStr, fSm, gray, cx(wStr, fSm), 194);
        }
        if (weather.rise >= 0 && weather.set >= 0) {
            const rStr = "Rise " + minsToTime12(weather.rise);
            const sStr = "Set " + minsToTime12(weather.set);
            render.drawText(rStr, fSm, dgray, 6, 212);
            render.drawText(sStr, fSm, dgray, W - render.getTextWidth(sStr, fSm) - 6, 212);
        }
    }

    render.end();
}

watch.addEventListener("minutechange", draw);
draw();
