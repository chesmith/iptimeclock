let blinkInterval;

module.exports = {
    displayClock: function(tick) {
        var blink = true;

        blinkInterval = setInterval(() => {
            let now = new Date();

            var hours = now.getHours();
            var minutes = now.getMinutes();
            var ampm = (hours >= 12 ? "PM" : "AM");
            hours = hours % 12;
            hours = hours ? hours : 12; // the hour '0' should be '12'
            minutes = minutes < 10 ? '0'+minutes : minutes;

            blink = !blink;
            tick(hours, minutes, ampm, blink);
        }, 1000);
    },

    killClock: function() {
        clearInterval(blinkInterval);
    }
}