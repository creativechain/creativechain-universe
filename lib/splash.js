

let userAddress = null;
let fileStorage = FileStorage.load();

trantor.events.subscribe('onStart', 'splash', function () {
    console.log('Trantor initialized!');
    setTimeout(function () {
        init();
    }, 3000);
});


function init() {
    userAddress = localStorage.getItem('userAddress');
    if (!userAddress) {
        trantor.client.getNewAddress(function (err, result) {
            if (err) {
                console.error(err);
            } else {
                localStorage.setItem('userAddress', result.result);
                setUserAddress();
            }
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

    if (localStorage.getItem('walletPassword')) {
        dialogs.alert(lang['WalletEncrypted']);
    } else {
        console.log(password, repeatPassword);
        if (password.length > 0 && repeatPassword.length > 0 && password === repeatPassword) {
            trantor.encryptWallet(password, function (err, result) {
                if (err) {
                    alert(err.message)
                } else {
                    console.log('Wallet encrypted!', result);
                    Notifications.notify(lang['Wallet'], lang['WalletEncrypted!'], './assets/img/icon-slide.png', 3);
                    localStorage.setItem('walletPassword', password);
                }
            })
        } else {
            dialogs.alert(lang['Passwords do not match']);
        }
    }
}

function initPlatform() {
    let pass = localStorage.getItem('walletPassword');
    console.log(pass);
    if (pass) {
        fileStorage.setKey('firstUseExecuted', true);
        window.location.href = 'index.html';
    } else{
        dialogs.alert(lang['EncryptWalletAlert']);
    }
}

function createBackup() {
    let dialog = control.dialog;

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