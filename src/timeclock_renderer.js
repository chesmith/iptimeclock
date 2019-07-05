const electron = require('electron');
const ipc = electron.ipcRenderer;
const timeclock = require('./js/timeclock.js');
const util = require('./js/util.js');
const brightness = require ('brightness');
window.$ = window.jQuery = require('jquery');

let teamMemberList = document.getElementById('teamMember');

let timerMessage;
let timerAlert;

let initialBrightness;
brightness.get().then(level => { initialBrightness = level; });

$('#online').text(`v${electron.remote.app.getVersion()}`);

//maintain an indicator (small dot, lower right corner) of online/offline status
setInterval(() => {
    util.checkOnlineStatus((err, online) => {
        let color;
        switch (online) {
            case 0: color = 'white'; break;
            case 2: case 3: color = 'orange'; break;
            default: color = 'red'
        }
        $('#online').css('color', color);
    });
}, 2500);

//handles clock updates sent by main.js
ipc.on('displayClock', (evt, currentHour, currentMinute, ampm, blink) => {
    $('#hour').html(currentHour);
    $('#minute').html(currentMinute + ' ' + ampm);
    if (blink)
        $('#colon').css('color', 'black');
    else
        $('#colon').css('color', 'white');
});

//show the settings icon/button only for mentors & leads
$('#teamMember').change(() => {
    let role = teamMemberList.options[teamMemberList.selectedIndex].getAttribute('data-role');
    showSettings(role == 'Mentor' || role == 'Lead');

    //send the team member ID to the passcode entry, so we can uniquely check passcode against the member record
    ipc.send('set-id', teamMemberList.value);
});

function showSettings(enable) {
    $('#settings').css('opacity', (enable ? '1' : '0'));
}

function displayInfo(text) {
    clearTimeout(timerMessage);
    $('#message').html(text);
    $('#message').fadeIn(500, () => {
        timerMessage = setTimeout(() => {
            $('#message').fadeOut(2000);
        }, 2500);
    });
}

function displayAlert(text) {
    $('#alert').text(text);
    timerAlert = setInterval(() => {
        $('#alert').fadeIn(500);
        setTimeout(() => {
            $('#alert').fadeOut(1500);
        }, 5000);
    }, 6500);
}

function clearAlert() {
    $('#alert').text('');
    clearInterval(timerAlert);
}

//clock in the team member, only if currently clocked out (alternate approach is to log a clock-in record regardless)
$('#clockIn').click(() => {
    let selectedIndex = teamMemberList.selectedIndex;
    if (selectedIndex == -1) {
        displayInfo('Please select a team member first');
        return;
    }
    let teamMemberId = teamMemberList.value;
    timeclock.isClockedIn(teamMemberId, (err, clockedIn) => {
        let firstname = teamMemberList[selectedIndex].getAttribute('data-firstname');
        if (clockedIn) {
            displayInfo(`${firstname} is already clocked in`);
        }
        else {
            timeclock.clockIn(teamMemberId, (err, clockTime) => {
                if (!err) {
                    let text = teamMemberList[selectedIndex].text;
                    if (text.indexOf('(') > -1)
                        text = text.substring(0, text.indexOf('(') - 1);
                    teamMemberList[selectedIndex].text = text + ` (in since ${util.formatTime(clockTime)})`;
                    displayInfo(`${firstname}, you've been clocked in`);
                }
            });
        }
    });
});

//clock out the team member, only if currently clocked in (alternate approach is to log a clock-out record regardless)
$('#clockOut').click(() => {
    let selectedIndex = teamMemberList.selectedIndex;
    if (selectedIndex == -1) {
        displayInfo('Please select a team member first');
        return;
    }
    let teamMemberId = teamMemberList.value;
    timeclock.isClockedIn(teamMemberId, (err, clockedIn) => {
        let firstname = teamMemberList[selectedIndex].getAttribute('data-firstname');
        if (clockedIn) {
            timeclock.clockOut(teamMemberId, (err, clockTime) => {
                if (!err) {
                    let text = teamMemberList[selectedIndex].text;
                    teamMemberList[selectedIndex].text = text.substring(0, text.indexOf('(') - 1);
                    displayInfo(`${firstname}, you've been clocked out`);
                }
            });
        }
        else {
            displayInfo(`${firstname} is already clocked out`);
        }
    });
});

//reload the team - currently, signal received from main.js on initial launch or when another window asks to reload
ipc.on('loadTeam', (evt, err, teamMembers) => {
    if (!err) {
        teamMemberList.options.length = 0;
        teamMembers.forEach((member) => {
            if (member.active) {
                option = document.createElement('option');
                option.value = member.id;
                option.setAttribute('data-firstname', member.firstname);
                option.setAttribute('data-lastname', member.lastname);
                option.setAttribute('data-role', member.role);
                option.setAttribute('data-punchtype', member.punchtype);
                option.setAttribute('data-punchtime', member.punchtime);
                option.text = ` ${(member.role == 'Mentor' ? `${member.role}: ` : '')}${member.lastname}, ${member.firstname}`;
                if (member.punchtype == 1) {
                    let punchtime = new Date(Date.parse(member.punchtime));
                    option.text += ` (in since ${util.formatTime(punchtime)})`;
                }
                teamMemberList.add(option);
            }
        });
        showSettings(false);
    }
});

//show the passcode window - only allow mentors and leads to access
$('#settings').click(() => {
    if (teamMemberList.selectedIndex > -1) {
        let role = teamMemberList.options[teamMemberList.selectedIndex].getAttribute('data-role');
        if (role != 'Student') {
            ipc.send('displayPasscodeEntry', 'displaySettings');
        }
    }
});

ipc.on('alert', (evt, text) => {
    displayAlert(text);
});

ipc.on('clear-alert', (evt) => {
    clearAlert();
});

//after 5 minutes of inactivity, zoom in on the clock, hide the rest of the stuff, and dim the screen - wake up on a tap
function screensaver(active) {
    if (active) {
        $("#container").fadeOut();
        $("#clock").animate({ 'font-size': '155px', 'top': '140px' }, 500);
        $("#clock").css({ 'justify-content': 'center' });
        $("#container").css('pointer-events', 'none');
        brightness.set(initialBrightness * 0.25);
    }
    else {
        brightness.set(initialBrightness);
        //necessary to put this in a timeout, else a wake-up tap will still tap something
        setTimeout(() => { $("#container").css('pointer-events', 'auto'); }, 500);
        $("#clock").css({ 'justify-content': 'unset' });
        $("#clock").animate({ 'font-size': '96px', 'top': '10px' }, 500);
        $("#container").fadeIn();
    }
}

function idleSetup() {
    var t;
    window.onload = resetTimer;
    window.onmousemove = resetTimer;
    window.onmousedown = resetTimer;  // catches touchscreen presses as well      
    window.ontouchstart = resetTimer; // catches touchscreen swipes as well 
    window.onclick = resetTimer;      // catches touchpad clicks as well
    window.onkeypress = resetTimer;
    window.addEventListener('scroll', resetTimer, true);

    function resetTimer() {
        screensaver(false);
        clearTimeout(t);
        t = setTimeout(onIdle, 300000);
    }
}

function onIdle() {
    screensaver(true);
}

idleSetup();