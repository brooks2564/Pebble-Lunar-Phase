// Message key indices (watch maps keys to 10000 + index)
var KEY_TEMP = 10000;  // temperature in Fahrenheit (integer)
var KEY_CODE = 10001;  // WMO weather code (integer)
var KEY_RISE = 10002;  // sunrise minutes from midnight (integer)
var KEY_SET  = 10003;  // sunset minutes from midnight (integer)

Pebble.addEventListener("ready", function() {
    console.log("Lunar Phase phone side ready");
    sendWeatherData();
});

function timeStrToMins(str) {
    // Parse "HH:MM" from end of ISO timestamp like "2026-04-18T06:30"
    var t = str.slice(-5).split(":");
    return parseInt(t[0]) * 60 + parseInt(t[1]);
}

function sendWeatherData() {
    navigator.geolocation.getCurrentPosition(
        function(pos) {
            var lat = pos.coords.latitude;
            var lon = pos.coords.longitude;
            var url =
                "https://api.open-meteo.com/v1/forecast" +
                "?latitude=" + lat +
                "&longitude=" + lon +
                "&current=temperature_2m,weathercode" +
                "&daily=sunrise,sunset" +
                "&temperature_unit=fahrenheit" +
                "&timezone=auto" +
                "&forecast_days=1";

            fetch(url)
                .then(function(r) { return r.json(); })
                .then(function(data) {
                    var temp  = Math.round(data.current.temperature_2m);
                    var code  = data.current.weathercode;
                    var rise  = -1;
                    var set   = -1;
                    try {
                        rise = timeStrToMins(data.daily.sunrise[0]);
                        set  = timeStrToMins(data.daily.sunset[0]);
                    } catch(e) {
                        console.log("Sunrise/sunset parse error: " + e);
                    }

                    var payload = {};
                    payload[KEY_TEMP] = temp;
                    payload[KEY_CODE] = code;
                    payload[KEY_RISE] = rise;
                    payload[KEY_SET]  = set;

                    Pebble.sendAppMessage(payload,
                        function() { console.log("Weather sent OK"); },
                        function(e) { console.log("Weather send failed: " + JSON.stringify(e)); }
                    );
                })
                .catch(function(e) {
                    console.log("Weather fetch failed: " + e);
                });
        },
        function(err) {
            console.log("Geolocation error: " + err.message);
        },
        { timeout: 15000 }
    );
}
