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
    $('#loading').css('display', 'none');
}

function populateDetails() {
    $('#firstname').val(selectedOption.getAttribute('data-firstname'));
    $('#lastname').val(selectedOption.getAttribute('data-lastname'));
    $('#email').val(selectedOption.getAttribute('data-email'));
    if (selectedOption.getAttribute('data-active') == 1) {
        $('#active').prop('checked', true);
    }
    else {
        $('#active').prop('checked', false);
    }
    let student = (selectedOption.getAttribute('data-role') == 'student');
    $('#roleStudent').prop('checked', student);
    $('#roleMentor').prop('checked', !student);
    let punchtype = selectedOption.getAttribute('data-punchtype');
    if (punchtype == 'null') {
        $('#lastPunch').text(`${$('#firstname').val()} has never clocked in`);
    }
    else {
        let punchtime = new Date(Date.parse(selectedOption.getAttribute('data-punchtime')));
        let message = `${$('#firstname').val()} last clocked ${(punchtype == '0' ? 'out' : 'in')} ${punchtime.toLocaleDateString()} ${util.formatTime(punchtime)}`;
        $('#lastPunch').text(message);
    }
}

$('#close').click( () => {
    ipc.send('reloadTeam');
    electron.remote.getCurrentWindow().hide();
});

$('#showInactive').change( () => {
    if (selectedId > -1 && !$('#showInactive').prop('checked') && selectedOption.getAttribute('data-active') == 0) {
        clearFields();
        selectedId = -1;
    }
    team.load(populateTeamMemberList);
});

$('#addNew').click( () => {
    teamMemberList.selectedIndex = -1;
    selectedId = -1;
    selectedOption = null;
    clearFields();
});

$('#save').click( () => {
    validateFields(() => {
        if (teamMemberList.selectedIndex > -1) {
            updateTeamMember(selectedId, () => {
                displayMessage('updated');
            });
        }
        else {
            addTeamMember(() => {
                displayMessage('added')
            });
        }
    });
});

$('#delete').click( () => {
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
    $('#firstname').val('');
    $('#lastname').val('');
    $('#email').val('');
    $('#roleStudent').prop('checked', false);
    $('#roleMentor').prop('checked', false);
    $('#active').prop('checked', true);
    $('#lastPunch').text('');
    $('#delete').css({'border-color': 'grey', 'color': 'grey'});
}

function validateFields(callback) {
    let role = '';
    if ($('#roleMentor').prop('checked'))
        role = 'mentor';
    else if ($('#roleStudent').prop('checked'))
        role = 'student';
    if ($('#firstname').val().length > 0 && $('#lastname').val().length > 0 && role.length > 0) {
        callback();
    }
    else {
        displayMessage('Error: Missing data');
    }
}

function displayMessage(text) {
    clearTimeout(messageTimer);
    $('#message').html(text);
    $("#message").fadeIn(500, "linear", () => {
        messageTimer = setTimeout(() => {
            $("#message").fadeOut(2000, "linear");
        }, 2500);
    });
}

function addTeamMember() {
    let role = '';
    if ($('#roleMentor').prop('checked'))
        role = 'mentor';
    else if ($('#roleStudent').prop('checked'))
        role = 'student';
    team.add($('#firstname').val(), $('#lastname').val(), $('#email').val(), role, (err, id) => {
        if (!err) {
            selectedId = id;
            $('#loading').css('display', 'inline');
            team.load(populateTeamMemberList);
        }
    });
}

function updateTeamMember() {
    let role = '';
    if ($('#roleMentor').prop('checked'))
        role = 'mentor';
    else if ($('#roleStudent').prop('checked'))
        role = 'student';
    team.update(selectedId, $('#firstname').val(), $('#lastname').val(), $('#email').val(), role, $('#active').prop('checked'), (err) => {
        if (!err) {
            if (!$('#active').prop('checked') && !$('#showInactive').prop('checked')) {
                clearFields();
                selectedId = -1;
                selectedOption = null;
                teamMemberList.remove(teamMemberList.selectedIndex);
            }
            else {
                //a full reload of the list takes too long on RPi - just update the list entry
                selectedOption.setAttribute('data-firstname', $('#firstname').val());
                selectedOption.setAttribute('data-lastname', $('#lastname').val());
                selectedOption.setAttribute('data-email', $('#email').val());
                selectedOption.setAttribute('data-role', role);
                selectedOption.setAttribute('data-active', ($('#active').prop('checked') ? '1' : '0'));
                selectedOption.text = ` ${(role == 'mentor' ? 'Mentor: ' : '')}${$('#lastname').val()}, ${$('#firstname').val()}`;
                if (!$('#active').prop('checked')) {
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

$('#clockOutAll').click( () => {
    timeclock.clockOutAll(() => {
        displayMessage('Clocked out everyone');
    });
});

$('input[name=timeframe]').change(() => {
    //clear the fields first - some issue prevents the control from updating properly without this
    $('#datetimepicker1').datetimepicker('date', null);
    $('#datetimepicker2').datetimepicker('date', null);

    var selection = $("input[name=timeframe]:checked").val();
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

$('#transmitReport').click( () => {
    var fromdate = $('#datetimepicker1').datetimepicker('date');
    var todate  = $('#datetimepicker2').datetimepicker('date');
    timeclock.generateReport(fromdate, todate, (err, reportfile) => {
        if(!err) {
            timeclock.sendReport(reportfile, (message) => {
                displayMessage(message);
            });
        }
        else {
            displayMessage(`Failed to transmit [${err}]`);
        }
    });
});

$('#displayReport').click( () => {
    var fromdate = $('#datetimepicker1').datetimepicker('viewDate');
    var todate  = $('#datetimepicker2').datetimepicker('viewDate');
    timeclock.displaySummaryReport(fromdate, todate, '#onscreenreport');
});

$('#teamMember').change( () => {
    if (teamMemberList.selectedIndex > -1) {
        selectedId = teamMemberList.value;
        selectedOption = teamMemberList[teamMemberList.selectedIndex];
        $('#delete').css({'border-color': 'red', 'color': 'red'});
    }
    else {
        selectedId = -1;
        selectedOption = null;
    }

    populateDetails();
});