const electron = require('electron');

const displayClock = require('./clock.js');
const team = require('./team.js');

const os = require('os');

const app = electron.app;
const BrowserWindow = electron.BrowserWindow;
const ipc = electron.ipcMain;

let mainWindow;

let kioskMode = (os.platform() == 'linux');

app.on('ready', _ => {
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

    mainWindow.webContents.once('dom-ready', _ => {
        displayClock((h, m, a, b) => {
            mainWindow.webContents.send('displayClock', h, m, a, b);
        });

        team.load((teamMembers) => {
            mainWindow.webContents.send('loadTeam', teamMembers);
        });
    });

    mainWindow.on('closed', _ => {
        mainWindow = null;
        console.log('closed - TODO notify someone');
    });

    mainWindow.show();
});

ipc.on('teamMemberChange', (evt, id, name) => {
    console.log('teamMemberChange: ' + id + " / " + name);
    //TODO
});

ipc.on('reloadTeam', (evt) => {
    console.log('mainjs reloadTeam');
    team.load((teamMembers) => {
        console.log('mainjs loadTeam team.load');
        mainWindow.webContents.send('loadTeam', teamMembers);
    });
});