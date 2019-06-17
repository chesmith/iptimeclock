const electron = require('electron');
const ipc = electron.ipcRenderer;
const timeclock = require('./js/timeclock.js');
const util = require('./js/util.js');
window.$ = window.jQuery = require('jquery');

let teamMemberList = document.getElementById('teamMember');

let timerMessage;
let timerAlert;

$('#online').text(`v${process.env.npm_package_version}`);

//maintain an indicator (small dot, lower right corner) of online/offline status
setInterval(() => {
    util.checkOnlineStatus((err, online) => {
        let color;
        // console.table([[`err`,`${err}`], [`online status`,`${online}`]]);
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

//show the settings icon/button only for mentors
$('#teamMember').change(() => {
    let role = teamMemberList.options[teamMemberList.selectedIndex].getAttribute('data-role');
    showSettings(role == 'mentor');

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
                option.text = ` ${(member.role == 'mentor' ? 'Mentor: ' : '')}${member.lastname}, ${member.firstname}`;
                if (member.punchtype == 1) {
                    let punchtime = new Date(Date.parse(member.punchtime));
                    option.text += ` (in since ${util.formatTime(punchtime)})`;
                }
                teamMemberList.add(option);
            }
        });
    }
});

//show the passcode window - only allow mentors to access
$('#settings').click(() => {
    if (teamMemberList.selectedIndex > -1) {
        let role = teamMemberList.options[teamMemberList.selectedIndex].getAttribute('data-role');
        if (role == 'mentor') {
            ipc.send('displayPasscodeEntry');
        }
    }
});