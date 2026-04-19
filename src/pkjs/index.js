var moddableProxy = require("./pebbleproxy");

Pebble.addEventListener("ready", function() {
    console.log("Lunar Phase ready");
    moddableProxy.readyReceived();
    sendWeatherData();
    setInterval(sendWeatherData, 30 * 60 * 1000);
});

Pebble.addEventListener("appmessage", function(e) {
    moddableProxy.appMessageReceived(e);
});

function timeStrToMins(str) {
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

            var xhr = new XMLHttpRequest();
            xhr.open("GET", url);
            xhr.onload = function() {
                if (xhr.status !== 200) return;
                try {
                    var data = JSON.parse(xhr.responseText);
                    var temp = Math.round(data.current.temperature_2m);
                    var code = data.current.weathercode || 0;
                    var rise = -1, set = -1;
                    try {
                        rise = timeStrToMins(data.daily.sunrise[0]);
                        set  = timeStrToMins(data.daily.sunset[0]);
                    } catch(e) {}
                    console.log("Weather: " + temp + "F code=" + code);
                    moddableProxy.sendAppMessage({
                        'TEMP': temp,
                        'CODE': code,
                        'RISE': rise,
                        'SET': set
                    });
                } catch(e) { console.log("Parse: " + e); }
            };
            xhr.onerror = function() { console.log("XHR error"); };
            xhr.send();
        },
        function(err) { console.log("Geo: " + err.code); },
        { timeout: 15000, maximumAge: 60000 }
    );
}
