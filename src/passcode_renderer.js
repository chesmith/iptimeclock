const electron = require('electron');
const ipc = electron.ipcRenderer;
const util = require('./js/util.js');
window.$ = window.jQuery = require('jquery');

var teamMemberId;
var passcode = '';
let validPasscodeTarget;

ipc.on('set-target', (evt, target) => {
    //allows for configuration of other targets after a valid passcode entry
    //assumes the value passed in to target is an IPC call channel (i.e. main.js will be listening for it)
    validPasscodeTarget = target;
});

//currently, only hide/show the window - don't destroy and recreate each time
$('#close').click( () => {
    electron.remote.getCurrentWindow().hide();
});

$('#backspace').click( () => {
    if (passcode.length > 0) {
        passcode = passcode.substring(0, passcode.length - 1);
        updateDisplay();
    }
});

//triggered on any numeric keypress, as those are the only ones prefixed with "key"
$('[id^=key]').click( (event) => {
    keypress(teamMemberId, event.target.id.substring(3));
});

function keypress(id, digit) {
    passcode += digit;
    updateDisplay();
    if (passcode.length == 4) {
        util.validatePasscode(id, passcode, (err, valid) => {
            if (!err) {
                reset();
                if (valid) {
                    ipc.send(validPasscodeTarget);
                }
                else {
                    $('#container').addClass('shake');
                    $('body').css('background-color', 'red');
                    var audio = new Audio('sounds/accessdenied.wav');
                    audio.play();
                    setTimeout(() => {
                        $('#container').removeClass('shake');
                        $('body').css('background-color', '')
                    }, 500);
                }
            }
        });
    }
}

function reset() {
    passcode = '';
    updateDisplay();
}

function updateDisplay() {
    $('#disp1').html((passcode.length > 0 ? '&middot;' : ''));
    $('#disp2').html((passcode.length > 1 ? '&middot;' : ''));
    $('#disp3').html((passcode.length > 2 ? '&middot;' : ''));
    $('#disp4').html((passcode.length > 3 ? '&middot;' : ''));
}

//leveraged by main view to set the ID of the member trying to login
ipc.on('set-id', (evt, id) => {
    teamMemberId = id;
});