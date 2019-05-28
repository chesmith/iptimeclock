const electron = require('electron');
const ipc = electron.ipcRenderer;
const timeclock = require('./timeclock.js');
const util = require('./util.js');

let teamMemberList = document.getElementById('teamMember');
let message = document.getElementById('message');
let timer;

teamMemberList.addEventListener('change', () => {
    let role = teamMemberList.options[teamMemberList.selectedIndex].getAttribute('data-role');
    showSettings(role == 'mentor');

    ipc.send('set-id', teamMemberList.value);
});

function showSettings(enable) {
    document.getElementById('settings').style.opacity = (enable ? '1' : '0');
}

function displayMessage(text) {
    clearTimeout(timer);
    message.innerText = text;
    message.classList.remove('fade-out');
    message.classList.add('fade-in');
    timer = setTimeout(() => {
        message.classList.remove('fade-in');
        message.classList.add('fade-out');
    }, 2500);
}

document.getElementById('clockIn').addEventListener('click', () => {
    let selectedIndex = teamMemberList.selectedIndex;
    if (selectedIndex == -1) {
        displayMessage('Please select a team member first');
        return;
    }
    let teamMemberId = teamMemberList.value;
    timeclock.isClockedIn(teamMemberId, (clockedIn) => {
        //TODO: "Looks like <user> is already clocked in.  Are you sure you want to clock in again?", and just let em
        let firstname = teamMemberList[selectedIndex].getAttribute('data-firstname');
        if (clockedIn) {
            displayMessage(`${firstname} is already clocked in`);
            console.log(`${teamMemberId}: can't clock in because they're not clocked out`);
        }
        else {
            console.log(`${teamMemberId}: clocking in`);
            timeclock.clockIn(teamMemberId, (err, clockTime) => {
                if (!err) {
                    let text = teamMemberList[selectedIndex].text;
                    //TODO: if allowing clocking in while already clocked in, first remove the 'in since' text, so we don't double up
                    // if(text.indexOf('(') > -1)
                    //     text = text.substring(0, text.indexOf('(') - 1);
                    teamMemberList[selectedIndex].text = text + ` (in since ${util.formatTime(clockTime)})`;
                    displayMessage(`${firstname}, you've been clocked in`);
                }
            });
        }
    });
});

document.getElementById('clockOut').addEventListener('click', () => {
    let selectedIndex = teamMemberList.selectedIndex;
    if (selectedIndex == -1) {
        displayMessage('Please select a team member first');
        return;
    }
    let teamMemberId = teamMemberList.value;
    timeclock.isClockedIn(teamMemberId, (clockedIn) => {
        let firstname = teamMemberList[selectedIndex].getAttribute('data-firstname');
        if (clockedIn) {
            console.log(`${teamMemberId}: clocking out`);
            timeclock.clockOut(teamMemberId, (err, clockTime) => {
                if (!err) {
                    let text = teamMemberList[selectedIndex].text;
                    teamMemberList[selectedIndex].text = text.substring(0, text.indexOf('(') - 1);
                    displayMessage(`${firstname}, you've been clocked out`);
                }
            });
        }
        else {
            displayMessage(`${firstname} is already clocked out`);
            console.log(`${teamMemberId}: can't clock out because they're not clocked in`);
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
});