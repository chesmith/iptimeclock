const electron = require('electron');
const ipc = electron.ipcRenderer;
const timeclock = require('./timeclock.js');

let teamMemberList = document.getElementById('teamMember');

teamMemberList.addEventListener('change', _ => {
    // ipc.send('teamMemberChange', teamMemberList.value, teamMember.options[teamMember.selectedIndex].text);
    //TODO: ? display info about the team member somewhere on the screen, like maybe last action and time
    let teamMemberId = teamMemberList.value;

    // timeclock.isClockedIn(teamMemberId, (clockedIn) => {
    //     if (clockedIn) {
    //         document.getElementById('clockIn').disabled = true;
    //         document.getElementById('clockIn').style.backgroundColor = "gray";
    
    //         document.getElementById('clockOut').disabled = false;
    //         document.getElementById('clockOut').style.backgroundColor = "blue";
    //     }
    //     else {
    //         document.getElementById('clockIn').disabled = false;
    //         document.getElementById('clockIn').style.backgroundColor = "red";
    
    //         document.getElementById('clockOut').disabled = true;
    //         document.getElementById('clockOut').style.backgroundColor = "gray";
    //     }
    // });
});

document.getElementById('clockIn').addEventListener('click', _ => {
    let teamMemberId = teamMemberList.value;
    let selectedIndex = teamMemberList.selectedIndex;
    timeclock.isClockedIn(teamMemberId, (clockedIn) => {
        //TODO: "Looks like <user> is already clocked in.  Are you sure you want to clock in again?", and just let em
        if (clockedIn) {
            console.log(`${teamMemberId}: can't clock out because they're not clocked in`);
        }
        else {
            console.log(`${teamMemberId}: clocking in`);
            timeclock.clockIn(teamMemberId, (clockTime) => {
                let text = teamMemberList[selectedIndex].text;
                //TODO: if allowing clocking in while already clocked in, first remove the 'in since' text, so we don't double up
                // if(text.indexOf('(') > -1)
                //     text = text.substring(0, text.indexOf('(') - 1);
                teamMemberList[selectedIndex].text = text + ` (in since ${formatTime(clockTime)})`;
            });
        }
    });
});

document.getElementById('clockOut').addEventListener('click', _ => {
    let teamMemberId = teamMemberList.value;
    let selectedIndex = teamMemberList.selectedIndex;
    timeclock.isClockedIn(teamMemberId, (clockedIn) => {
        //TODO: "Looks like <user> is already clocked out.  Are you sure you want to clock out again?", and just let em
        if (clockedIn) {
            console.log(`${teamMemberId}: clocking out`);
            timeclock.clockOut(teamMemberId, (clockTime) => {
                let text = teamMemberList[selectedIndex].text;
                teamMemberList[selectedIndex].text = text.substring(0, text.indexOf('(') - 1);
            });
        }
        else {
            console.log(`${teamMemberId}: can't clock in because they're not clocked out`);
        }
    });
});

ipc.on('displayClock', (evt, currentHour, currentMinute, ampm, blink) => {
    document.getElementById('hour').innerHTML = currentHour;
    document.getElementById('minute').innerHTML = currentMinute + ' ' + ampm;
    if (blink)
        document.getElementById('colon').style.color = "black";
    else
        document.getElementById('colon').style.color = "#CCC";
});

ipc.on('loadTeam', (evt, teamMembers) => {
    teamMembers.forEach(function (member) {
        option = document.createElement('option');
        option.text = member.lastname + ", " + member.firstname;
        if(member.punchtype == 1) {
            let punchtime = new Date(Date.parse(member.punchtime));
            option.text += ` (in since ${formatTime(punchtime)})`;
        }
        option.value = member.id;
        teamMemberList.add(option);
    });
});

function formatTime(timeToFormat) {
    var hours = timeToFormat.getHours();
    var minutes = timeToFormat.getMinutes();
    var ampm = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    minutes = minutes < 10 ? '0'+minutes : minutes;
    return hours + ':' + minutes + ' ' + ampm;
}

document.getElementById('settings').addEventListener('click', _ => {
    let win = new electron.remote.BrowserWindow({
        width: 400,
        height: 400,
        frame: false,
        parent: electron.remote.getCurrentWindow(),
        modal: true
      })
    
      win.loadURL(`file://${__dirname}/settings.html`);
});