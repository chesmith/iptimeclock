const electron = require('electron');

const clock = require('./js/clock.js');
const team = require('./js/team.js');
const util = require('./js/util.js');
const fs = require('fs');
const path = require('path');

const os = require('os');

const config = require('./js/config.js');

const log = require('electron-log');
const {autoUpdater} = require("electron-updater");

const app = electron.app;
const BrowserWindow = electron.BrowserWindow;
const ipc = electron.ipcMain;

let mainWindow;
let passcodeWindow;
let settingsWindow;
let autoUpdateInterval;

let kioskMode = (os.platform() == 'linux');

autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';
log.info('App starting...');

app.on('ready', () => {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 480,
        frame: false,
        kiosk: kioskMode,
        show: false,
        webPreferences: {
            nodeIntegration: true,
            // worldSafeExecuteJavaScript: true,
            // contextIsolation: true,
            enableRemoteModule: true
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
        app.quit();
    });

    passcodeWindow = new BrowserWindow({
        width: 260,
        height: 410,
        frame: false,
        parent: mainWindow,
        modal: true,
        show: false,
        webPreferences: {
            nodeIntegration: true,
            // worldSafeExecuteJavaScript: true,
            // contextIsolation: true,
            enableRemoteModule: true
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
            nodeIntegration: true,
            // worldSafeExecuteJavaScript: true,
            // contextIsolation: true,
            enableRemoteModule: true
        }
    });
    settingsWindow.loadURL(`file://${__dirname}/settings.html`);

    settingsWindow.on('show', (evt) => {
        team.load((err, teamMembers) => {
            settingsWindow.webContents.send('reset');
            settingsWindow.webContents.send('loadTeam', err, teamMembers);
        });
    });

    autoUpdateInterval = setInterval(() => {
        autoUpdater.checkForUpdates();
      }, 20000);
});

ipc.on('displayPasscodeEntry', (evt, target) => {
    passcodeWindow.send('set-target', target);
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

ipc.on('overrideAutoClockOut', (evt) => {
    mainWindow.webContents.send('overrideAutoClockOut');
});

ipc.on('set-id', (evt, id) => {
    passcodeWindow.webContents.send('set-id', id);
    settingsWindow.webContents.send('set-id', id);
});

app.on('certificate-error', (event, webContents, url, error, certifiate, callback) => {
    if (url === config.wifi[config.selectedWifi].portalUrl) {
        //ignore certificate errors, since this uses a self-signed cert
        event.preventDefault();
        callback(true);
    } else {
        callback(false);
    }
});

function sendStatusToWindow(text) {
    log.info(text);
    mainWindow.webContents.send('alert', text);
}

autoUpdater.on('update-available', (info) => {
    clearInterval(autoUpdateInterval);
    sendStatusToWindow('Update available');
});

autoUpdater.on('error', (err) => {
    console.warn(`Error in auto-updater - check log`);
    // sendStatusToWindow(`Error in auto-updater`);
});

autoUpdater.on('download-progress', (progressObj) => {
    sendStatusToWindow(`Downloaded ${progressObj.percent.toFixed(0)}%`);
});

autoUpdater.on('update-downloaded', (info) => {
    log.info('Quitting and installing update');
    mainWindow.webContents.send('clear-alert');
    autoUpdater.quitAndInstall();  
});
