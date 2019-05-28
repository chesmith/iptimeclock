const electron = require('electron');

const displayClock = require('./clock.js');
const team = require('./team.js');

const os = require('os');

const app = electron.app;
const BrowserWindow = electron.BrowserWindow;
const ipc = electron.ipcMain;

let mainWindow;
let passcodeWindow;

let kioskMode = (os.platform() == 'linux');

app.on('ready', () => {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 480,
        frame: false,
        kiosk: kioskMode,
        show: false,
        webPreferences: {
            nodeIntegration: true
          }
    });

    mainWindow.loadURL(`file://${__dirname}/timeclock.html`);

    mainWindow.webContents.once('dom-ready', () => {
        displayClock((h, m, a, b) => {
            mainWindow.webContents.send('displayClock', h, m, a, b);
        });

        team.load((teamMembers) => {
            mainWindow.webContents.send('loadTeam', teamMembers);
        });
        mainWindow.show();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
        //TODO: notify someone
    });

    passcodeWindow = new BrowserWindow({
        width: 260,
        height: 410,
        frame: false,
        parent: mainWindow,
        modal: true,
        show: false,
        webPreferences: {
            nodeIntegration: true
        }
    });
    passcodeWindow.loadURL(`file://${__dirname}/passcode.html`);

    settingsWindow = new BrowserWindow({
        width: 798,
        height: 478,
        frame: false,
        parent: mainWindow,
        modal: true,
        show: false,
        webPreferences: {
            nodeIntegration: true
        }
    });
    settingsWindow.loadURL(`file://${__dirname}/settings.html`);
});

ipc.on('displayPasscodeEntry', (evt) => {
    passcodeWindow.show();
});

ipc.on('displaySettings', (evt) => {
    team.load((teamMembers) => {
        settingsWindow.webContents.send('loadTeam', teamMembers);
    });
    passcodeWindow.hide();
    settingsWindow.show();
});

ipc.on('reloadTeam', (evt) => {
    team.load((teamMembers) => {
        mainWindow.webContents.send('loadTeam', teamMembers);
    });
});

ipc.on('set-id', (evt, id) => {
    passcodeWindow.webContents.send('set-id', id);
});