const electron = require('electron');

const clock = require('./js/clock.js');
const team = require('./js/team.js');
const config = require('./js/config.js');
const util = require('./js/util.js');

const os = require('os');

const app = electron.app;
const BrowserWindow = electron.BrowserWindow;
const ipc = electron.ipcMain;

let mainWindow;
let passcodeWindow;
let settingsWindow;

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
        clock.displayClock((h, m, a, b) => {
            mainWindow.webContents.send('displayClock', h, m, a, b);
        });

        team.load((err, teamMembers) => {
            mainWindow.webContents.send('loadTeam', err, teamMembers);
        });
        mainWindow.show();
    });

    mainWindow.on('close', () => {
        clock.killClock();
        //TODO: for some reason, this doesn't work here - util.emailMentors('Someone shut down the timeclock');
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
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

    settingsWindow.on('show', (evt) => {
        team.load((err, teamMembers) => {
            settingsWindow.webContents.send('reset');
            settingsWindow.webContents.send('loadTeam', err, teamMembers);
        });
    });
});

ipc.on('displayPasscodeEntry', (evt) => {
    passcodeWindow.show();
});

ipc.on('displaySettings', (evt) => {
    passcodeWindow.hide();
    settingsWindow.show();
});

ipc.on('reloadTeam', (evt) => {
    team.load((err, teamMembers) => {
        mainWindow.webContents.send('loadTeam', err, teamMembers);
    });
});

ipc.on('set-id', (evt, id) => {
    passcodeWindow.webContents.send('set-id', id);
    settingsWindow.webContents.send('set-id', id);
});

app.on('certificate-error', (event, webContents, url, error, certifiate, callback) => {
    if (url === util.decrypt(config.wifi.portalUrl)) {
        //ignore certificate errors, since this uses a self-signed cert
        event.preventDefault();
        callback(true);
    } else {
        callback(false);
    }
});