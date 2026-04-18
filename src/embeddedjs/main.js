import { Rocky } from "pebble/graphics";
import Message from "pebble/message";

let weather = { temp: null, code: -1, rise: -1, set: -1 };

let msg;
msg = new Message({
    keys: ["TEMP", "CODE", "RISE", "SET"],
    input: {
        onReadable(count) {
            const map = msg.read();
            if (map.has("TEMP")) weather.temp = map.get("TEMP");
            if (map.has("CODE")) weather.code = map.get("CODE");
            if (map.has("RISE")) weather.rise = map.get("RISE");
            if (map.has("SET"))  weather.set  = map.get("SET");
            rocky.requestDraw();
        }
    }
});

// Moon phase: 0 = new moon, 0.5 = full moon, 1 = new moon again
function getMoonPhase(date) {
    const ref   = new Date(Date.UTC(2000, 0, 6, 18, 14, 0));
    const cycle = 29.53058867;
    let days    = (date.getTime() - ref.getTime()) / 86400000;
    let phase   = (days % cycle) / cycle;
    if (phase < 0) phase += 1;
    return phase;
}

function getPhaseName(phase, full) {
    if (phase < 0.0625 || phase >= 0.9375) return "New Moon";
    if (phase < 0.1875) return full ? "Waxing Crescent" : "Wax. Crescent";
    if (phase < 0.3125) return "First Quarter";
    if (phase < 0.4375) return full ? "Waxing Gibbous"  : "Wax. Gibbous";
    if (phase < 0.5625) return "Full Moon";
    if (phase < 0.6875) return full ? "Waning Gibbous"  : "Wan. Gibbous";
    if (phase < 0.8125) return "Last Quarter";
    return full ? "Waning Crescent" : "Wan. Crescent";
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
    const h   = Math.floor(mins / 60);
    const m   = mins % 60;
    const h12 = h % 12 || 12;
    return h12 + ":" + (m < 10 ? "0" : "") + m;
}

// Scan-line moon drawing (no clip() available in Rocky)
function drawMoon(ctx, cx, cy, r, phase) {
    // Dark moon background
    ctx.fillStyle = "#1a1a2e";
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 6.2832);
    ctx.fill();

    // Illuminated portion
    ctx.fillStyle = "#fffde7";
    for (let dy = -r; dy <= r; dy++) {
        const chord = Math.sqrt(r * r - dy * dy);
        let x1, x2;
        if (phase < 0.5) {
            // Waxing: right side lit; terminator moves left as phase grows
            const tx = Math.cos(phase * 6.2832) * chord;
            x1 = tx; x2 = chord;
        } else {
            // Waning: left side lit; terminator moves right as phase grows
            const tx = Math.cos((phase - 0.5) * 6.2832) * chord;
            x1 = -chord; x2 = tx;
        }
        if (x2 > x1) {
            const lx = Math.ceil(cx + x1);
            const rx = Math.floor(cx + x2);
            if (rx > lx) ctx.fillRect(lx, cy + dy, rx - lx, 1);
        }
    }

    // Outline
    ctx.strokeStyle = "#444444";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 6.2832);
    ctx.stroke();
}

const rocky = new Rocky();

rocky.on("draw", function(event) {
    const ctx   = event.context;
    const w     = ctx.canvas.clientWidth;
    const h     = ctx.canvas.clientHeight;
    const round = (w === h);   // gabbro is 180x180; emery is 200x228
    const cx    = Math.floor(w / 2);
    const now   = new Date();
    const phase = getMoonPhase(now);

    // Background
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, w, h);

    // Time string (12-hour, no AM/PM)
    const hrs    = now.getHours();
    const min    = now.getMinutes();
    const h12    = hrs % 12 || 12;
    const timeStr = h12 + ":" + (min < 10 ? "0" : "") + min;

    const DAYS   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const dateStr = DAYS[now.getDay()] + " " + MONTHS[now.getMonth()] + " " + now.getDate();

    ctx.textAlign = "center";

    if (round) {
        // ── Gabbro 180x180 (round) ──────────────────────────────────────
        const moonR  = 50;
        const moonCY = 97;

        // Time
        ctx.fillStyle = "#ffffff";
        ctx.font = "34px Bitham-numeric";
        ctx.fillText(timeStr, cx, 18);

        // Moon
        drawMoon(ctx, cx, moonCY, moonR, phase);

        // Phase name (abbreviated to fit round screen)
        ctx.fillStyle = "#cccccc";
        ctx.font = "14px bold Gothic";
        ctx.fillText(getPhaseName(phase, false), cx, 151);

        // Weather: temp + condition on one line
        if (weather.temp !== null) {
            const cond = getCondition(weather.code);
            const wStr = weather.temp + "\u00b0F" + (cond ? "  " + cond : "");
            ctx.fillStyle = "#888888";
            ctx.font = "14px Gothic";
            ctx.fillText(wStr, cx, 164);
        }

    } else {
        // ── Emery 200x228 (rectangular) ─────────────────────────────────
        const moonR  = 55;
        const moonCY = 135;

        // Time
        ctx.fillStyle = "#ffffff";
        ctx.font = "42px bold Bitham";
        ctx.fillText(timeStr, cx, 4);

        // Date
        ctx.fillStyle = "#777777";
        ctx.font = "18px Gothic";
        ctx.fillText(dateStr, cx, 50);

        // Separator
        ctx.strokeStyle = "#333333";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(20, 71);
        ctx.lineTo(w - 20, 71);
        ctx.stroke();

        // Moon
        drawMoon(ctx, cx, moonCY, moonR, phase);

        // Phase name (full)
        ctx.fillStyle = "#cccccc";
        ctx.font = "14px bold Gothic";
        ctx.fillText(getPhaseName(phase, true), cx, 194);

        // Weather line
        if (weather.temp !== null) {
            const cond = getCondition(weather.code);
            const wStr = weather.temp + "\u00b0F" + (cond ? "  " + cond : "");
            ctx.fillStyle = "#777777";
            ctx.font = "14px Gothic";
            ctx.fillText(wStr, cx, 210);
        }

        // Sunrise / Sunset at bottom corners
        if (weather.rise >= 0 && weather.set >= 0) {
            ctx.font = "14px Gothic";
            ctx.fillStyle = "#555555";
            ctx.textAlign = "left";
            ctx.fillText("Rise " + minsToTime12(weather.rise), 6, 210);
            ctx.textAlign = "right";
            ctx.fillText("Set " + minsToTime12(weather.set), w - 6, 210);
        }
    }
});

rocky.on("minutechange", function(event) {
    rocky.requestDraw();
});
