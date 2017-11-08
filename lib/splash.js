
let fileStorage = FileStorage.load();
let maxTaks = 3;
let currentTask = 0;
let walletPassword;
let downloading = false;

trantor.events.subscribe('onStart', 'splash', function () {
    console.log('Trantor initialized!');
    setTask(3);
    setTimeout(function () {
        init();
    }, 3000);
});

function setTask(task) {
    currentTask = task;
    $('#progress-bar').attr('value', 0);

    let progressText = String.format(lang.PerformingTasks, currentTask, maxTaks);
    $('#progress-text').html(progressText);
}

trantor.events.subscribe('onDaemonDownload', 'splash', function (args) {
    if (!downloading) {
        setTask(1);
        downloading = true;
    }
    let progress = args[0];
    $('#progress-bar').attr('value', progress);

});

function init() {
    let userAddress = localStorage.getItem('userAddress');
    if (!userAddress) {
        trantor.client.getNewAddress(function (err, result) {
            if (err) {
                console.error(err);

                //In case of error, try get new address on every second
                setTimeout(function () {
                    init();
                }, 1000);
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
    let userAddress = localStorage.getItem('userAddress');
    $('#user-address').html(userAddress);
}

function encryptWallet() {

    let password = $('#wallet-password').val();
    let repeatPassword = $('#wallet-repeat-password').val();

    if (walletPassword) {
        dialogs.alert(lang['WalletEncrypted']);
    } else {
        console.log(password, repeatPassword);
        if (password.length > 0 && repeatPassword.length > 0 && password === repeatPassword) {
            trantor.encryptWallet(password, function (err, result) {
                if (err) {
                    dialogs.alert(err.message)
                    walletPassword = true;
                } else {
                    setTask(2);
                    walletPassword = password;
                    console.log('Wallet encrypted!', result);
                    Notifications.notify(lang['Wallet'], lang['WalletEncrypted!'], './assets/img/wallet-alert', 3);
                    setTimeout(function () {
                        setTask(3);
                        trantor.start();
                    }, 1000 * 10)
                }
            })
        } else {
            dialogs.alert(lang['Passwords do not match']);
        }
    }
}

function initPlatform() {
    if (walletPassword) {
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