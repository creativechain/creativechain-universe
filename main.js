const electron = require('electron');
const {dialog, ipcMain, remote, BrowserWindow} = electron;

const path = require('path');
const url = require('url');
const request = require('request');
const locale = require('os-locale');
const isDev = require('electron-is-dev');
const app = electron.app;

global.appPath = __dirname;

const {File, FileStorage, OS, Monetary, Constants} = require('creativechain-platform-core');
const {Coin} = Monetary;

let constants = Constants.MainnetConstants;

let fileStorage = FileStorage.load(constants.APP_CONF_FILE);
// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.

/**
 * @type {BrowserWindow}
 */
let platformWindow;

ipcMain.on('closedAllClients', function () {
    console.log('All clients are closed');
    platformWindow.destroy();
});

locale().then(lang => {
    let settings = FileStorage.load(constants.APP_CONF_FILE);
    let langDir = constants.ASAR_DIR + '/assets/lang/';
    let content = null;
    lang = settings.getKey('language') || lang.slice(0, 2).toLowerCase();
    let langFile = langDir + lang + '.json';
    console.log(lang, langFile);
    if (File.exist(langFile)) {
        content = File.read(langFile);
    } else {
        content = File.read(langDir + 'en.json');
    }

    //console.log(content)
    global.lang = JSON.parse(content);
    global.locale = lang;

});

global.ticker = {};

function ticker() {
    console.log('Getting ticker...');
    let settings = FileStorage.load(constants.APP_CONF_FILE);
    let fiat = (settings.getKey('exchange-coin') || 'usd').toUpperCase();
    let url = 'https://api.coinmarketcap.com/v1/ticker/creativecoin/?convert=' + fiat;
    let responseVar = 'price_' + fiat.toLowerCase();
    request(url, function (error, response, body) {
        if (error) {
            console.error(error);
            global.ticker.price_btc = Coin.parseCash(0, 'BTC');
            global.ticker.price_usd = Coin.parseCash(0, 'USD');
            global.ticker[responseVar] = Coin.parseCash(0, fiat);
        } else {
            try {
                body = JSON.parse(body);
                body = body[0];
                global.ticker.price_btc = Coin.parseCash(body.price_btc, 'BTC');
                global.ticker.price_usd = Coin.parseCash(body.price_usd, 'USD');
                global.ticker[responseVar] = Coin.parseCash(body[responseVar], fiat);

            } catch (err) {
                console.error(err, error, response, body);
            }
        }
    })
}

setInterval(function () {
    ticker();
}, 10 * 60 * 1000);

function createWindow () {
    // Create the browser window.
    platformWindow = new BrowserWindow({
        width: 1400,
        height: 1200,
        'minWidth': 800,
        'minHeight': 600,
        frame: true,
        backgroundColor: '#fff',
        'web-preferences': {
            'enable-drag-out': false
        }
    });

    //Uncommment for show default menu bar
    platformWindow.setMenu(null);
    //win.maximize();
    // and load the index.html of the app.

    let initPage = 'slide-1.html';
    if (fileStorage.getKey('firstUseExecuted')) {
        initPage = 'platform.html';
    }

    platformWindow.loadURL(url.format({
        pathname: path.join(__dirname, initPage),
        protocol: 'file:',
        slashes: true
    }));

    let pjson = require('./package.json');
    // Open the DevTools.
    if (isDev || pjson.buildVersion) {
        platformWindow.webContents.openDevTools();
    }

    ticker();
    platformWindow.on('close', function (e) {
        console.log('Handled close event!');
        e.preventDefault();
        e.sender.send('stop-clients');
    });
    // Emitted when the window is closed.
    platformWindow.on('closed', () => {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        platformWindow = null
    });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', function () {
    createWindow();

});
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
    if (platformWindow === null) {
        createWindow()
    }
});

app.on('uncaughtException', function (error) {
    console.error(error);
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate fs and require them here.
