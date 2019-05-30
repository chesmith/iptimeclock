const electron = require('electron');
const ipc = electron.ipcRenderer;
const timeclock = require('./timeclock.js');
const util = require('./util.js');
// const isOnline = require('is-online');

let teamMemberList = document.getElementById('teamMember');
let infoMessage = document.getElementById('message');
let alertMessage = document.getElementById('alert');
let timerMessage;

setInterval(() => {
    util.checkOnlineStatus((err, online) => {
        let color;
        console.table([[`err`,`${err}`], [`online status`,`${online}`]]);
        switch(online) {
            case 0: color = 'white'; break;
            case 2: case 3: color = 'orange'; break;
            default: color = 'red'
        }
        document.getElementById('online').style.color = color;
    });
}, 2500);

teamMemberList.addEventListener('change', () => {
    let role = teamMemberList.options[teamMemberList.selectedIndex].getAttribute('data-role');
    showSettings(role == 'mentor');

    ipc.send('set-id', teamMemberList.value);
});

function showSettings(enable) {
    document.getElementById('settings').style.opacity = (enable ? '1' : '0');
}

function displayInfo(text) {
    //TODO: i suspect i can do this with a single animation and class set
    clearTimeout(timerMessage);
    infoMessage.innerText = text;
    infoMessage.classList.remove('fade-out');
    infoMessage.classList.add('fade-in');
    timerMessage = setTimeout(() => {
        infoMessage.classList.remove('fade-in');
        infoMessage.classList.add('fade-out');
        infoMessage.innerText = '';
    }, 2500);
}

function displayAlert(text) {
    alertMessage.innerText = text;
    alertMessage.classList.add('fade-bounce');
}

function clearAlert() {
    alertMessage.innerText = '';
    alertMessage.classList.remove('fade-bounce');
}

document.getElementById('clockIn').addEventListener('click', () => {
    let selectedIndex = teamMemberList.selectedIndex;
    if (selectedIndex == -1) {
        displayInfo('Please select a team member first');
        return;
    }
    let teamMemberId = teamMemberList.value;
    timeclock.isClockedIn(teamMemberId, (clockedIn) => {
        //TODO: "Looks like <user> is already clocked in.  Are you sure you want to clock in again?", and just let em
        let firstname = teamMemberList[selectedIndex].getAttribute('data-firstname');
        if (clockedIn) {
            displayInfo(`${firstname} is already clocked in`);
        }
        else {
            timeclock.clockIn(teamMemberId, (err, clockTime) => {
                if (!err) {
                    let text = teamMemberList[selectedIndex].text;
                    //TODO: if allowing clocking in while already clocked in, first remove the 'in since' text, so we don't double up
                    // if(text.indexOf('(') > -1)
                    //     text = text.substring(0, text.indexOf('(') - 1);
                    teamMemberList[selectedIndex].text = text + ` (in since ${util.formatTime(clockTime)})`;
                    displayInfo(`${firstname}, you've been clocked in`);
                }
            });
        }
    });
});

document.getElementById('clockOut').addEventListener('click', () => {
    let selectedIndex = teamMemberList.selectedIndex;
    if (selectedIndex == -1) {
        displayInfo('Please select a team member first');
        return;
    }
    let teamMemberId = teamMemberList.value;
    timeclock.isClockedIn(teamMemberId, (clockedIn) => {
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

ipc.on('displayClock', (evt, currentHour, currentMinute, ampm, blink) => {
    document.getElementById('hour').innerHTML = currentHour;
    document.getElementById('minute').innerHTML = currentMinute + ' ' + ampm;
    if (blink)
        document.getElementById('colon').style.color = "black";
    else
        document.getElementById('colon').style.color = "white";
});

ipc.on('loadTeam', (evt, teamMembers) => {
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
            option.text = ' ' + (member.role == 'mentor' ? 'Mentor: ' : '') + member.lastname + ", " + member.firstname;
            if (member.punchtype == 1) {
                let punchtime = new Date(Date.parse(member.punchtime));
                option.text += ` (in since ${util.formatTime(punchtime)})`;
            }
            teamMemberList.add(option);
        }
    });
});

document.getElementById('settings').addEventListener('click', () => {
    if (teamMemberList.selectedIndex > -1) {
        let role = teamMemberList.options[teamMemberList.selectedIndex].getAttribute('data-role');
        if (role == 'mentor') {
            ipc.send('displayPasscodeEntry');
        }
    }

    // util.connectWifi();
});