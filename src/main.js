const electron = require('electron');

const clock = require('./clock.js');
const team = require('./team.js');
const util = require('./util.js');

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

        team.load((teamMembers) => {
            mainWindow.webContents.send('loadTeam', teamMembers);
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
        team.load((teamMembers) => {
            settingsWindow.webContents.send('reset');
            settingsWindow.webContents.send('loadTeam', teamMembers);
        });
    });
});

ipc.on('displayPasscodeEntry', (evt) => {
    passcodeWindow.show();
});

ipc.on('displaySettings', (evt) => {
    // team.load((teamMembers) => {
    //     settingsWindow.webContents.send('loadTeam', teamMembers);
    // });
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

app.on('certificate-error', (event, webContents, url, error, certifiate, callback) => {
    if(url === '***REMOVED***') {  //ignore certificate errors, since this uses a self-signed cert
        event.preventDefault();
        callback(true);
    } else {
        callback(false);
    }
});