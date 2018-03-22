const electron = require('electron');
const {dialog, ipcMain, remote} = require('electron');

require('electron-dl')();
const path = require('path');
const url = require('url');
const request = require('request');
const locale = require('os-locale');
const isDev = require('electron-is-dev');
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;

global.appPath = __dirname;

const {Coin, File, OS, Constants, FileStorage, Network, Trantor} = require('./lib/trantor');

let fileStorage = FileStorage.load();
// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let platformWindow;

locale().then(lang => {
    let settings = FileStorage.load();
    let content = null;
    lang = settings.getKey('language') || lang.slice(0, 2).toLowerCase();
    let langFile = Constants.LANG_FOLDER + lang + '.json';
    console.log(lang, langFile);
    if (File.exist(langFile)) {0
        content = File.read(langFile);
    } else {
        content = File.read(Constants.LANG_FOLDER  + 'en.json');
    }

    //console.log(content)
    global.lang = JSON.parse(content);
    global.locale = lang;

});

global.ticker = {};

function ticker() {
    console.log('Getting ticker...');
    let settings = FileStorage.load();
    let fiat = (settings.getKey('exchange-coin') || 'usd').toUpperCase();
    let url = Constants.TICKER_URL + fiat;
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
    } else {
        let path = Constants.BIN_FOLDER + Constants.BINARY_NAME;
        path = path.replace(/\//g, '\\');
        OS.run('del ' + path, function (result, stderr) {
            console.log(result, stderr);
        })
    }

    platformWindow.loadURL(url.format({
        pathname: path.join(__dirname, initPage),
        protocol: 'file:',
        slashes: true
    }));

    // Open the DevTools.
    platformWindow.webContents.openDevTools();

    ticker();
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
