const {app, BrowserWindow} = require('electron');
require('electron-dl')();

const path = require('path');
const url = require('url');

const {File, OS, Constants} = require('./lib/utils');
// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win;

function createWindow () {
    // Create the browser window.
    win = new BrowserWindow({width: 800, height: 600});
    //Uncommment for show default menu bar
    win.setMenu(null);
    win.maximize();

    // and load the index.html of the app.
    win.loadURL(url.format({
        pathname: path.join(__dirname, 'index.html'),
        protocol: 'file:',
        slashes: true
    }));

    // Open the DevTools.
    win.webContents.openDevTools();

    // Emitted when the window is closed.
    win.on('closed', () => {
        let mainPid = Constants.BIN_FOLDER + 'creativecoin.pid';
        let testnetPid = Constants.BIN_FOLDER + 'testnet3/creativecoin.pid';
        if (File.exist(mainPid)) {
            let content = File.read(mainPid);
            OS.run('kill ' + content, function (result) {

            })
        }

        if (File.exist(testnetPid)) {
            let content = File.read(testnetPid);
            OS.run('kill ' + content, function (result) {

            })
        }
        //console.log('closing window');
        //Preferences.setNodeCorrectlyRunning(false);
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        win = null
    })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);
// Quit when all windows are closed.
app.on('window-all-closed', () => {
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {

        app.quit()
    }
});

app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (win === null) {
        createWindow()
    }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate fs and require them here.