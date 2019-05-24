const electron = require('electron');
const ipc = electron.ipcRenderer;

document.getElementById('close').addEventListener('click', _ => {
    electron.remote.getCurrentWindow().close();
});
