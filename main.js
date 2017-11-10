const {app, BrowserWindow, dialog} = require('electron');
require('electron-dl')();

const path = require('path');
const url = require('url');
const request = require('request');
const locale = require('os-locale');

dialog.showErrorBox = function(title, content) {
    console.log(`${title}\n${content}`);
};

global.appPath = app.getAppPath();

const {Coin, File, OS, Constants, FileStorage, Network, Trantor} = require('./lib/trantor');

let fileStorage = FileStorage.load();
// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win;

if (!String.format) {
    /**
     *
     * @param {string} format
     * @return {*|void|XML|string}
     */
    String.format = function(format) {
        let args = Array.prototype.slice.call(arguments, 1);
        return format.replace(/{(\d+)}/g, function(match, number) {
            return typeof args[number] !== 'undefined' ? args[number] : match;
        });
    };
}

if (!String.hexEncode) {
    /**
     *
     * @param {string} str
     * @return {String}
     */
    String.hexEncode = function (str) {
        return Buffer.from(str, 'utf8').toString('hex');
    }
}

if (!String.hexDecode) {
    /**
     *
     * @param {string} hex
     * @return {String}
     */
    String.hexDecode = function (hex) {
        return Buffer.from(hex, 'hex').toString('utf8');
    }
}

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

let trantor = new Trantor();
global.trantor = trantor;

function ticker() {
    console.log('Getting ticker...');
    request(Constants.TICKER_URL, function (error, response, body) {
        try {
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
        } catch (err) {
            console.error(err, error, response, body);
        }

    })
}

setInterval(function () {
    ticker();
}, 10 * 60 * 1000);

function createWindow () {
    // Create the browser window.
    win = new BrowserWindow({
        width: 1400,
        height: 1200,
        minWidth: 800,
        minHeight: 600,
        frame: false
    });
    //Uncommment for show default menu bar
    win.setMenu(null);
    //win.maximize();
    // and load the index.html of the app.

    let initPage = 'slide-1.html';
    if (fileStorage.getKey('firstUseExecuted')) {
        initPage = 'platform.html';
    }

    win.loadURL(url.format({
        pathname: path.join(__dirname, initPage),
        protocol: 'file:',
        slashes: true
    }));

    // Open the DevTools.
    win.webContents.openDevTools();

    ticker();
    // Emitted when the window is closed.
    win.on('closed', () => {
        trantor.stop();
        //console.log('closing window');
        //Preferences.setNodeCorrectlyRunning(false);
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        win = null
    });
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

app.on('uncaughtException', function (error) {
    console.error(error);
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate fs and require them here.