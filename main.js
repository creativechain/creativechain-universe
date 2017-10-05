const {app, BrowserWindow} = require('electron');
require('electron-dl')();

const path = require('path');
const url = require('url');
const request = require('request');
const locale = require('os-locale');

const {Coin, File, OS, Constants, Network, Trantor} = require('./lib/trantor');

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win;

locale().then(lang => {
    console.log(lang);

    let content = null;
    lang = lang.slice(0, 2).toLowerCase();
    if (File.exist(Constants.LANG_FOLDER + lang + '.json')) {
        content = File.read(Constants.LANG_FOLDER + lang + '.json');
    } else {
        content = File.read(Constants.LANG_FOLDER  + 'en.json');
    }

    lang = JSON.parse(content);
    global.lang = lang;

});

global.ticker = {};

function ticker() {
    console.log('Getting ticker...');
    request(Constants.TICKER_URL, function (error, response, body) {
        body = JSON.parse(body);
        body = body[0];
        global.ticker.price_btc = Coin.parseCash(body.price_btc, 'BTC');
        global.ticker.price_usd = Coin.parseCash(body.price_usd, 'USD');
        global.ticker.price_eur = Coin.parseCash(body.price_eur, 'EUR');

        if (global.ticker.listener) {
            global.ticker.listener();
        } else {
            console.log('Listener is null');
        }
    })
}

setInterval(function () {
    ticker();
}, 10 * 60 * 1000);

function createWindow () {
    // Create the browser window.
    win = new BrowserWindow({width: 800, height: 600});
    //Uncommment for show default menu bar
    win.setMenu(null);
    win.maximize();
    // and load the index.html of the app.
    win.loadURL(url.format({
        pathname: path.join(__dirname, 'slide-1.html'),
        protocol: 'file:',
        slashes: true
    }));

    // Open the DevTools.
    win.webContents.openDevTools();

    ticker();
    // Emitted when the window is closed.
    win.on('closed', () => {
        let trantor = new Trantor(Network.TESTNET);
        trantor.stop(OS, Constants.BIN_FOLDER);
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