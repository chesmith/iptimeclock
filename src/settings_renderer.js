const electron = require('electron');
const ipc = electron.ipcRenderer;
const { dialog } = require('electron').remote
const team = require('./js/team.js');
const util = require('./js/util.js');
const timeclock = require('./js/timeclock.js');
window.$ = window.jQuery = require('jquery');
window.Bootstrap = require('bootstrap');
const datepicker = require('tempusdominus-bootstrap-4');

let teamMemberList = document.getElementById('teamMember');

let messageTimer;
let selectedMemberId;
let selectedOption;
let adminId;

ipc.on('loadTeam', (evt, err, teamMembers) => {
    populateTeamMemberList(err, teamMembers);
});

ipc.on('reset', (evt) => {
    selectedMemberId = -1;
    selectedOption = null;
    clearFields();
});

function populateTeamMemberList(err, teamMembers) {
    if (!err) {
        teamMemberList.options.length = 0;
        teamMembers.forEach((member) => {
            if (member.active || $('#showInactive').prop('checked')) {
                option = document.createElement('option');
                option.value = member.id;
                option.setAttribute('data-firstname', member.firstname);
                option.setAttribute('data-lastname', member.lastname);
                option.setAttribute('data-email', member.email);
                option.setAttribute('data-role', member.role);
                option.setAttribute('data-active', member.active);
                option.setAttribute('data-punchtype', member.punchtype);
                option.setAttribute('data-punchtime', member.punchtime);
                if (member.role != 'Student' && member.passcode.length > 0) {
                    option.setAttribute('data-passcode', '********');
                }
                else {
                    option.setAttribute('data-passcode', '');
                }
                let role = (member.role != 'Student' ? `${member.role}: ` : '');
                option.text = `  ${role}${member.lastname}, ${member.firstname}`;
                if (!member.active) {
                    option.text += ' (inactive)';
                }
                teamMemberList.add(option);
            }
        });
        if (selectedMemberId > -1) {
            teamMemberList.value = selectedMemberId;
            selectedOption = teamMemberList[teamMemberList.selectedIndex];
        }
    }
    $('#loading').hide();
}

function populateDetails() {
    $('#firstname').val(selectedOption.getAttribute('data-firstname'));
    $('#lastname').val(selectedOption.getAttribute('data-lastname'));
    $('#email').val(selectedOption.getAttribute('data-email'));
    $('#active').prop('checked', (selectedOption.getAttribute('data-active') == '1'));
    $('#student').prop('checked', (selectedOption.getAttribute('data-role') == 'Student'));
    $('#lead').prop('checked', (selectedOption.getAttribute('data-role') == 'Lead'));
    $('#mentor').prop('checked', (selectedOption.getAttribute('data-role') == 'Mentor'));
    $('#passcode').val(selectedOption.getAttribute('data-passcode'));

    enablePasscode(selectedOption.getAttribute('data-role') != 'Student');

    let punchtype = selectedOption.getAttribute('data-punchtype');
    let lastPunchMessage = '';
    if (punchtype == 'null') {
        lastPunchMessage = `${$('#firstname').val()} has never clocked in`;
    }
    else {
        let punchtime = new Date(Date.parse(selectedOption.getAttribute('data-punchtime')));
        lastPunchMessage = `${$('#firstname').val()} last clocked ${(punchtype == '0' ? 'out' : 'in')}<br/> ${punchtime.toLocaleDateString()} ${util.formatTime(punchtime)}`;
    }
    $('#lastPunch').html(lastPunchMessage);
}

$('#close').on('click', () => {
    ipc.send('reloadTeam');
    electron.remote.getCurrentWindow().hide();
});

$('#teamMember').on('change', () => {
    if (teamMemberList.selectedIndex > -1) {
        selectedMemberId = teamMemberList.value;
        selectedOption = teamMemberList[teamMemberList.selectedIndex];
        $('#delete').css({ 'border-color': 'red', 'color': 'red' });
    }
    else {
        selectedMemberId = -1;
        selectedOption = null;
    }

    populateDetails();
});

$('#showInactive').on('change', () => {
    if (selectedMemberId > -1) {
        let selectedMemberIsInactive = (selectedOption.getAttribute('data-active') == 0);
        let showInactive = $('#showInactive').prop('checked');
        if (selectedMemberIsInactive && !showInactive) {
            clearFields();
            selectedMemberId = -1;
        }
    }
    team.load(populateTeamMemberList);
});

$('#addNew').on('click', () => {
    teamMemberList.selectedIndex = -1;
    selectedMemberId = -1;
    selectedOption = null;
    clearFields();
});

$('#passcode').on('click', () => {
    $('#passcode').select();
});

$("input:radio[name='role']").on('change', () => {
    let role = $("input:radio[name ='role']:checked").val();
    if (typeof role == 'undefined') role = '';

    enablePasscode(role != 'Student');
});

function enablePasscode(enable) {
    if (enable) {
        $('#passcode').prop('disabled', false);
        $('#passcode').css({ 'background-color': 'white' });
    }
    else {
        $('#passcode').prop('disabled', true);
        $('#passcode').css({ 'background-color': 'gray' });
    }
}

$('#save').on('click', () => {
    validateFields(() => {
        if (teamMemberList.selectedIndex > -1) {
            updateTeamMember((err) => {
                if(!err) {
                    displayMessage('Updated');
                }
                else {
                    displayMessage('Error updating');
                }
            });
        }
        else {
            addTeamMember((err) => {
                if(!err) {
                    displayMessage('Added');
                }
                else {
                    displayMessage('Error adding');
                }
            });
        }
    });
});

function validateFields(callback) {
    let role = $("input:radio[name ='role']:checked").val();
    if (typeof role == 'undefined') role = '';

    if ($('#firstname').val().length > 0 && $('#lastname').val().length > 0 && role.length > 0
        && ($('#passcode').val().length == 0 || $('#passcode').val().length == 4 || $('#passcode').val() == '********'))
    {
        callback();
    }
    else {
        displayMessage('Error: Missing data');
    }
}

$('#delete').on('click', () => {
    let options = {
        type: 'question',
        buttons: ['Yes', 'No'],
        defaultId: 1,
        title: 'Question',
        message: 'Are you sure you want to remove this team member?',
        detail: `They won't show in any views, but will still exist in the database`
    };
    dialog.showMessageBox(
        null, 
        options
    ).then(result => {
        if (result.response === 0) {
            deleteTeamMember();
        }
    });
});

function clearFields() {
    $('#firstname').val('');
    $('#lastname').val('');
    $('#email').val('');
    $('#passcode').val('');
    enablePasscode(false);
    $('#student').prop('checked', false);
    $('#mentor').prop('checked', false);
    $('#active').prop('checked', true);

    $('#delete').css({ 'border-color': 'grey', 'color': 'grey' });
    $('#lastPunch').html('');
}

function displayMessage(text) {
    clearTimeout(messageTimer);
    $('#message').html(text);
    $('#message').fadeIn(500, 'linear', () => {
        messageTimer = setTimeout(() => {
            $('#message').fadeOut(2000, 'linear');
        }, 2500);
    });
}

function addTeamMember(callback) {
    let role = $("input:radio[name ='role']:checked").val();
    if (typeof role == 'undefined') role = 'Student';

    team.add($('#firstname').val(), $('#lastname').val(), $('#email').val(), $('#passcode').val(), role, adminId, (err, id) => {
        if (!err) {
            selectedMemberId = id;
            $('#loading').show();
            team.load(populateTeamMemberList);
        }
        callback(err);
    });
}

function updateTeamMember(callback) {
    let role = $("input:radio[name ='role']:checked").val();
    if (typeof role == 'undefined') role = 'Student';

    team.update(selectedMemberId, $('#firstname').val(), $('#lastname').val(), $('#email').val(), $('#passcode').val(), role, $('#active').prop('checked'), adminId, (err) => {
        if (!err) {
            if (!$('#active').prop('checked') && !$('#showInactive').prop('checked')) {
                //if currently selected member has been deactivated and we're not showing active, reset everything and remove that team member
                clearFields();
                selectedMemberId = -1;
                selectedOption = null;
                teamMemberList.remove(teamMemberList.selectedIndex);
            }
            else {
                //a full reload of the list takes too long on RPi - just update the list entry
                selectedOption.setAttribute('data-firstname', $('#firstname').val());
                selectedOption.setAttribute('data-lastname', $('#lastname').val());
                selectedOption.setAttribute('data-email', $('#email').val());
                selectedOption.setAttribute('data-passcode', ($('#passcode').val().length > 0 ? '********' : ''));
                selectedOption.setAttribute('data-role', role);
                selectedOption.setAttribute('data-active', ($('#active').prop('checked') ? '1' : '0'));
                selectedOption.text = ` ${(role != 'Student' ? `${role}: ` : '')}${$('#lastname').val()}, ${$('#firstname').val()}`;
                if (!$('#active').prop('checked')) {
                    selectedOption.text += ' (inactive)';
                }
            }
        }
        callback(err);
    });
}

function deleteTeamMember() {
    clearFields();
    team.delete(selectedMemberId, (err) => {
        if (!err) {
            selectedMemberId = -1;
            selectedOption = null;
            teamMemberList.remove(teamMemberList.selectedIndex);
        }
    });
}

$('#clockOutAll').on('click', () => {
    timeclock.clockOutAll(() => {
        displayMessage('Clocked out everyone');
    });
});

$('#overrideAutoClockOut').on('click', () => {
    displayMessage('Disabled auto clock out for today only');
    ipc.send('overrideAutoClockOut');
});

$('input[name=timeframe]').on('change', () => {
    //clear the fields first - some issue prevents the control from updating properly without this
    $('#datetimepicker1').datetimepicker('date', null);
    $('#datetimepicker2').datetimepicker('date', null);

    var selection = $('input[name=timeframe]:checked').val();
    var start = moment();
    var end = moment();
    switch (selection) {
        case 'thisweek':
            start = moment().startOf('week');
            end = moment(start).endOf('week');
            break;
        case 'lastweek':
            start = moment().startOf('week').add(-7, 'days');
            end = moment(start).endOf('week');
            break;
        case 'thismonth':
            end = moment().endOf('month');
            start = moment(end).startOf('month');
            break;
        case 'lastmonth':
            end = moment().startOf('month').add(-1, 'days');
            start = moment(end).startOf('month');
            break;
        case 'customrange':
            start = null;
            end = null;
            break;
    }

    $('#datetimepicker1').datetimepicker('date', start);
    $('#datetimepicker2').datetimepicker('date', end);

    $('#onscreenreport').html('');
});

$('#transmitReport').on('click', () => {
    var fromdate = $('#datetimepicker1').datetimepicker('date');
    var todate = $('#datetimepicker2').datetimepicker('date');
    if (fromdate == null || todate == null) {
        displayMessage('Please select a valid date range');
    }

    timeclock.generateDetailReport(fromdate, todate, (err, reportfile) => {
        if (!err) {
            timeclock.generateSummaryReport(fromdate, todate, (err, summary) => {
                timeclock.sendReport(fromdate, todate, reportfile, summary, adminId, (message) => {
                    displayMessage(message);
                });
            });
        }
        else {
            displayMessage(`Failed to generate report [${err}]`);
        }
    });
});

$('#displayReport').on('click', () => {
    var fromdate = $('#datetimepicker1').datetimepicker('viewDate');
    var todate = $('#datetimepicker2').datetimepicker('viewDate');
    timeclock.generateSummaryReport(fromdate, todate, (err, summary) => {
        if (!err) {
            $('#onscreenreport').html(summary);
        }
        else {
            displayMessage(`Failed to generate report [${err}]`);
        }
    });
});

//leveraged by main view to set the ID of the member using settings (presumably a mentor)
ipc.on('set-id', (evt, id) => {
    adminId = id;
});