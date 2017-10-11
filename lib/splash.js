const {Network, Trantor, Notifications, FileStorage, Constants, File} = require('./lib/trantor');
let intent = require('electron').remote;

let trantor = new Trantor(Network.TESTNET);
let userAddress = null;
let fileStorage = FileStorage.load();
trantor.start(function () {
    console.log('Trantor initialized!');
    setTimeout(function () {
        init();
    }, 3000);
});

function init() {
    userAddress = localStorage.getItem('userAddress');
    if (!userAddress) {
        trantor.client.getNewAddress(function (err, result) {
            console.log(err, result);
            localStorage.setItem('userAddress', result.result);
            setUserAddress();
        })
    } else {
        setUserAddress();
    }

}

function setUserAddress() {
    $('#user-address').html(userAddress);
}

function encryptWallet() {

    let password = $('#wallet-password').val();
    let repeatPassword = $('#wallet-repeat-password').val();

    if (localStorage.getItem('password')) {
        alert(lang['WalletEncrypted']);
    } else {
        console.log(password, repeatPassword);
        if (password.length > 0 && repeatPassword.length > 0 && password === repeatPassword) {
            trantor.encryptWallet(password, function (err, result) {
                if (err) {
                    alert(err.message)
                } else {
                    console.log('Wallet encrypted!', result);
                    Notifications.notify(lang['Wallet'], lang['WalletEncrypted!'], './assets/img/icon-slide.png', 3);
                    localStorage.setItem('password', password);
                    setTimeout(function () {
                        trantor.start();
                    }, 1000)
                }
            })
        } else {
            alert(lang['Passwords do not match']);
        }
    }
}

function initPlatform() {
    if (!localStorage.getItem('password')) {
        fileStorage.setKey('firstUseExecuted', true);
        window.location.href = 'index.html';
    } else{
        alert(lang['EncryptWalletAlert']);
    }
}

function createBackup() {
    let dialog = intent.dialog;

    dialog.showSaveDialog(function (fileName) {
        console.log(fileName);
        if (fileName === undefined) {

        } else {
            let isTestnet = trantor.network === Network.TESTNET;
            let walletPath = Constants.BIN_FOLDER + (isTestnet ? 'testnet3' + Constants.FILE_SEPARATOR : '') + 'wallet.dat';
            console.log(walletPath);
            File.cp(walletPath, fileName);
            Notifications.notify(lang['Backup'], fileName, './assets/img/wallet-alert.png', 2);
        }
    })
}