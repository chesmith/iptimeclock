const electron = require('electron');
const ipc = electron.ipcRenderer;
const { dialog } = require('electron').remote
const team = require('./team.js');
const util = require('./util.js');
const timeclock = require('./timeclock.js');

let teamMemberList = document.getElementById('teamMember');
let firstName = document.getElementById('firstname');
let lastName = document.getElementById('lastname');
let active = document.getElementById('active');
let roleStudent = document.getElementById('student');
let roleMentor = document.getElementById('mentor');

let timer;
let selectedId;
let selectedOption;

ipc.on('loadTeam', (evt, teamMembers) => {
    populateTeamMemberList(teamMembers);
});

ipc.on('reset', (evt) => {
    selectedId = -1;
    selectedOption = null;
    clearFields();
});

function populateTeamMemberList(teamMembers) {
    let showInactive = document.getElementById('showInactive').checked;
    teamMemberList.options.length = 0;
    teamMembers.forEach((member) => {
        if (member.active || showInactive) {
            option = document.createElement('option');
            option.value = member.id;
            option.setAttribute('data-firstname', member.firstname);
            option.setAttribute('data-lastname', member.lastname);
            option.setAttribute('data-role', member.role);
            option.setAttribute('data-active', member.active);
            option.setAttribute('data-punchtype', member.punchtype);
            option.setAttribute('data-punchtime', member.punchtime);
            option.text = ' ' + (member.role == 'mentor' ? 'Mentor: ' : '') + member.lastname + ', ' + member.firstname;
            if (!member.active) {
                option.text += ' (inactive)';
            }
            teamMemberList.add(option);
        }
    });
    if (selectedId > -1) {
        teamMemberList.value = selectedId;
        selectedOption = teamMemberList[teamMemberList.selectedIndex];
    }
    document.getElementById('loading').style.display = 'none';
}

function populateDetails() {
    firstName.value = selectedOption.getAttribute('data-firstname');
    lastName.value = selectedOption.getAttribute('data-lastname');
    if (selectedOption.getAttribute('data-active') == 1) {
        active.checked = true;
    }
    else {
        active.checked = false;
    }
    let student = (selectedOption.getAttribute('data-role') == 'student');
    roleStudent.checked = student;
    roleMentor.checked = !student;
    let punchtype = selectedOption.getAttribute('data-punchtype');
    if (punchtype == 'null') {
        document.getElementById('lastPunch').innerText = 'Has never clocked in';
    }
    else {
        let punchtime = new Date(Date.parse(selectedOption.getAttribute('data-punchtime')));
        let message = `Last clocked ${(punchtype == '0' ? 'out' : 'in')} ${punchtime.toLocaleDateString()} ${util.formatTime(punchtime)}`;
        document.getElementById('lastPunch').innerText = message;
    }
}

document.getElementById('close').addEventListener('click', () => {
    ipc.send('reloadTeam');
    electron.remote.getCurrentWindow().hide();
});

document.getElementById('showInactive').addEventListener('change', () => {
    if (selectedId > -1 && !document.getElementById('showInactive').checked && selectedOption.getAttribute('data-active') == 0) {
        clearFields();
        selectedId = -1;
    }
    team.load(populateTeamMemberList);
});

document.getElementById('addNew').addEventListener('click', () => {
    teamMemberList.selectedIndex = -1;
    selectedId = -1;
    selectedOption = null;
    clearFields();
});

document.getElementById('save').addEventListener('click', () => {
    validateFields(() => {
        if (teamMemberList.selectedIndex > -1) {
            updateTeamMember(selectedId, () => {
                displayInfo('updated');
            });
        }
        else {
            addTeamMember(() => {
                displayInfo('added')
            });
        }
    });
});

document.getElementById('delete').addEventListener('click', () => {
    let options = {
        type: 'question',
        buttons: ['Yes', 'No'],
        defaultId: 1,
        title: 'Question',
        message: 'Are you sure you want to remove this team member?',
        detail: `They won't show in any views, but will still exist in the database`
    };
    dialog.showMessageBox(null, options, (response) => {
        if (response == 0) {
            deleteTeamMember();
        }
    });
});

function clearFields() {
    firstName.value = '';
    lastName.value = '';
    email.value = '';
    roleStudent.checked = false;
    roleMentor.checked = false;
    active.checked = true;
    document.getElementById('lastPunch').innerText = '';
}

function validateFields(callback) {
    let role = '';
    if (roleMentor.checked)
        role = 'mentor';
    else if (roleStudent.checked)
        role = 'student';
    if (firstName.value.length > 0 && lastName.value.length > 0 && role.length > 0) {
        callback();
    }
    else {
        displayInfo('Error: Missing data');
    }
}

function displayInfo(text) {
    clearTimeout(timer);
    message.innerHTML = text;
    message.classList.remove('fade-out');
    message.classList.add('fade-in');
    timer = setTimeout(() => {
        message.classList.remove('fade-in');
        message.classList.add('fade-out');
        message.innerHTML = '';
    }, 2500);
}

function addTeamMember() {
    let role = '';
    if (roleMentor.checked)
        role = 'mentor';
    else if (roleStudent.checked)
        role = 'student';
    team.add(firstName.value, lastName.value, email.value, role, (err, id) => {
        if (!err) {
            selectedId = id;
            document.getElementById('loading').style.display = 'inline';
            team.load(populateTeamMemberList);
        }
    });
}

function updateTeamMember() {
    let role = '';
    if (roleMentor.checked)
        role = 'mentor';
    else if (roleStudent.checked)
        role = 'student';
    team.update(selectedId, firstName.value, lastName.value, email.value, role, active.checked, (err) => {
        if (!err) {
            if (!active.checked && !document.getElementById('showInactive').checked) {
                clearFields();
                selectedId = -1;
                selectedOption = null;
                teamMemberList.remove(teamMemberList.selectedIndex);
            }
            else {
                //a full reload of the list takes too long on RPi - just update the list entry
                selectedOption.setAttribute('data-firstname', firstName.value);
                selectedOption.setAttribute('data-lastname', lastName.value);
                selectedOption.setAttribute('data-role', role);
                selectedOption.setAttribute('data-active', (active.checked ? '1' : '0'));
                selectedOption.text = ' ' + (role == 'mentor' ? 'Mentor: ' : '') + lastName.value + ', ' + firstName.value;
                if (!active.checked) {
                    selectedOption.text += ' (inactive)';
                }
            }
        }
    });
}

function deleteTeamMember() {
    clearFields();
    team.delete(selectedId, (err) => {
        if (!err) {
            selectedId = -1;
            selectedOption = null;
            teamMemberList.remove(teamMemberList.selectedIndex);
        }
    });
}

document.getElementById('clockOutAll').addEventListener('click', () => {
    timeclock.clockOutAll(() => {
        displayInfo('Clocked out everyone');
    });
});

document.getElementById('transmitReports').addEventListener('click', () => {
    //TODO: not even sure what type of "reports", except to simply pull data for a given date/time range
    //      popup date/time range selection
    timeclock.generateReport((err, reportfile) => {
        if(!err) {
            timeclock.sendReport(reportfile, (message) => {
                displayInfo(message);
            });
        }
        else {
            displayInfo(`Failed to transmit [${err}]`);
        }
    });
});

teamMemberList.addEventListener('change', () => {
    if (teamMemberList.selectedIndex > -1) {
        selectedId = teamMemberList.value;
        selectedOption = teamMemberList[teamMemberList.selectedIndex];
    }
    else {
        selectedId = -1;
        selectedOption = null;
    }

    populateDetails();
});
