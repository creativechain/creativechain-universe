const {Network, Trantor, CreativeCoin, Globals, FileStorage} = require('./lib/trantor');
const Dialogs = require('dialogs');
let dialogs = Dialogs();

let sessionStorage = FileStorage.load('./session.crea');
let trantor = new Trantor(Network.TESTNET);


function inputPassword() {
    let reqPass = sessionStorage.getKey('passwordRequested', false);
    if (!reqPass) {
        dialogs.prompt(lang['EnterPassword'], null, function (password) {
            if (password === undefined) { // Canceled
                window.close();
            } else if (password) {
                autoSession(password);
                putTopBalance();
            } else {
                inputPassword();
            }
        })
    } else {
        autoSession(Globals.get('walletPassword'));
    }
}

function autoSession(password) {
    let now = new Date().getTime();
    let sessionExpireTime = sessionStorage.getKey('sessionExpireTime', 0);
    let timeout = sessionExpireTime - now;
    timeout = parseInt(timeout / 1000);
    let reqPass = sessionStorage.getKey('passwordRequested', false);
    if (timeout > 0 && reqPass) {
        sessionStorage.setKey('passwordRequested', true);
        setTimeout(function () {
            autoSession(password);
        }, timeout * 1000)
    } else {
        trantor.client.walletPassPhrase(password, SESSION_DURATION_MILLIS / 1000, function (err, result) {
            if (err) {
                console.error(err);
                dialogs.alert(err.message, function (ok) {
                    sessionStorage.setKey('passwordRequested', false);
                    inputPassword();
                })
            } else {
                console.log('Session started!');
                let sessionTime = new Date().getTime();
                sessionExpireTime = sessionTime + SESSION_DURATION_MILLIS;
                sessionStorage.setKey('passwordRequested', true);
                Globals.set('walletPassword', password);
                sessionStorage.setKey('sessionTime', sessionTime);
                sessionStorage.setKey('sessionExpireTime', sessionExpireTime);
                setTimeout(function () {
                    autoSession(password);
                }, SESSION_DURATION_MILLIS);
            }
        });
    }
}


function putTopBalance() {
    let balance = {};
    trantor.client.getBalance('*', 0, function (err, result) {
        let amount = result.result * Math.pow(10, 8);
        balance.total = new CreativeCoin(amount);
        $('#top-balance').html(balance.total.toString());
        $('#top-balance-tooltip').attr('title', balance.total.toString());
    });
}

function search(words) {
    onSearch = true;
    if (!words) {
        words = $('#content-search').val();
        words.replace(' ', '+');
    }

    words = words.split('+');

    trantor.search(words, function (result) {
        loadItems(result);
    });

}

function onSearchText(e) {
    if (e.keyCode === 13 || e.keyCode === 10) { //Enter Key
        search();
    } else {
        let val = $('#content-search').val();
        if (!val || val.length === 0) {
            onSearch = false;
            loadAllMedia();
        }
    }

    return true;
}

trantor.start(function () {
    console.log('Trantor started!');
    inputPassword();
});