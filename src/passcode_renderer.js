const electron = require('electron');
const ipc = electron.ipcRenderer;
const util = require('./util.js');

var id;
var passcode = "";

var container = document.getElementById('container');

document.getElementById('close').addEventListener('click', () => {
    electron.remote.getCurrentWindow().hide();
});

document.getElementById('backspace').addEventListener('click', () => {
    if (passcode.length > 0) {
        passcode = passcode.substring(0, passcode.length - 1);
        updateDisplay();
    }
});

document.getElementById('1').addEventListener('click', () => { keypress(this.id, '1') });
document.getElementById('2').addEventListener('click', () => { keypress(this.id, '2') });
document.getElementById('3').addEventListener('click', () => { keypress(this.id, '3') });
document.getElementById('4').addEventListener('click', () => { keypress(this.id, '4') });
document.getElementById('5').addEventListener('click', () => { keypress(this.id, '5') });
document.getElementById('6').addEventListener('click', () => { keypress(this.id, '6') });
document.getElementById('7').addEventListener('click', () => { keypress(this.id, '7') });
document.getElementById('8').addEventListener('click', () => { keypress(this.id, '8') });
document.getElementById('9').addEventListener('click', () => { keypress(this.id, '9') });
document.getElementById('0').addEventListener('click', () => { keypress(this.id, '0') });

function keypress(id, digit) {
    passcode += digit;
    updateDisplay();
    if (passcode.length == 4) {
        util.validatePasscode(id, passcode, (err, valid) => {
            if (!err) {
                reset();
                if (valid) {
                    ipc.send('displaySettings');
                }
                else {
                    reset();
                    container.classList.add('shake');
                    setTimeout(() => { container.classList.remove('shake'); }, 500);
                }
            }
        });
    }
}

function reset() {
    passcode = "";
    updateDisplay();
}

function updateDisplay() {
    document.getElementById('disp1').innerHTML = (passcode.length > 0 ? '&middot;' : '');
    document.getElementById('disp2').innerHTML = (passcode.length > 1 ? '&middot;' : '');
    document.getElementById('disp3').innerHTML = (passcode.length > 2 ? '&middot;' : '');
    document.getElementById('disp4').innerHTML = (passcode.length > 3 ? '&middot;' : '');
}

ipc.on('set-id', (evt, id) => {
    this.id = id;
});