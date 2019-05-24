module.exports = function displayClock(tick) {
    var blink = true;

    setInterval(_ => {
        let now = new Date();

        var hours = now.getHours();
        var minutes = now.getMinutes();
        var ampm = (hours > 12 ? "PM" : "AM");

        if (hours > 12) { hours = hours - 12 };
        if (minutes < 10) { minutes = "0" + minutes; }

        blink = !blink;
        tick(hours, minutes, ampm, blink);
    }, 1000);
}