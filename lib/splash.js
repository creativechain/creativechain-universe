
let fileStorage = FileStorage.load();
let walletPassword;
let downloading = false;
let initialized = false;
let syncProcess;
let coreLoaded = -1;

$(document).ready(function () {
    console.log('Document ready');
    enablePasswordInput(false);
    let leftArrow = $('#slide-left-arrow');
    let rightArrow = $('#slide-right-arrow');


    leftArrow.click(function (event) {
        let slide = $('.item.active').attr('id');
        slide = slide.replace('slide-', '');
        console.log('to left', slide);
        slide = parseInt(slide);
        if (slide === 1) {
            return false;
        }
    });

    rightArrow.click(function (event) {
        let slide = $('.item.active').attr('id');
        slide = slide.replace('slide-', '');
        //console.log('to right', slide);
        slide = parseInt(slide);
        if (coreLoaded === -1 && slide === 5) {
            coreLoaded = 0;
            modal.loading()
        } else if (coreLoaded === 0 && slide === 6){
            return false
        } else if (slide === 9) {
            return false;
        }
    });

    $(document).keydown(function (event) {
        let element;
        //console.log(event.which);
        switch (event.which) {
            case 37: //left arrow
                element = leftArrow;
                break;
            case 39: //right arrow
                element = rightArrow;
                break;
            default:
                return;
        }

        element.click();
        event.preventDefault();
        return false;

    })
});

trantor.events.subscribe('onDaemonDownload', 'splash', function (args) {
    if (!downloading) {
        setTask(lang.DownloadingResources);
        downloading = true;
    }
    let progress = args[0];
    $('#progress-bar').attr('value', progress);

    console.log('Downloading daemon', progress);
    if (progress >= 100) {
        onSyncStart();
        enablePasswordInput(true);
    }

});

trantor.events.subscribe('onStart', 'splash', function () {
    console.log('Trantor initialized!');
    onSyncStart();

    let checkWalletEncryption = function () {
        //Checking if wallet.dat is encrypted
        trantor.client.help(function (err, result) {
            if (err) {
                console.error(err);
                setTimeout(function () {
                    checkWalletEncryption();
                }, 500);
            } else {
                //console.log(result);
                if (result.indexOf('walletlock') >= 0 ) {
                    walletPassword = true;

                }
            }
        })
    };

    setTimeout(function () {
        checkWalletEncryption();
    }, 1000);

    if (walletPassword) {
        enablePasswordInput();
        handleSyncProgress();
    }

});

trantor.events.subscribe('onLog', 'splash', function (args) {
    console.log.apply(console, args);
});

function onSyncStart() {
    if (!initialized) {
        setTask(lang.Synchronizing);
        handleSyncProgress();
        initialized = true;
    }

    setTimeout(function () {
        init();
    }, 3000);
}


function handleSyncProgress() {

    let onSync = function () {
        trantor.client.getBlockchainInfo(function (err, result) {
            if (err) {
                console.error(err);
            } else {
                if (!coreLoaded) {
                    modal.hide();
                }

                enablePasswordInput(true);
                coreLoaded = 1;
                //console.log(result);
                console.log('Blockchain sync', result.blocks + ' / ' + result.headers);
                setTask(lang.Synchronizing)
                setProgress(result.blocks, result.headers);

                if (parseInt(result.blocks) >= parseInt(result.headers)) {
                    clearInterval(syncProcess);
                }
            }
        });
    };

    syncProcess = setInterval(function () {
        onSync();
    }, 500);
}

function setProgress(progress, max = 0) {

    if (max) {
        $('#progress-bar').attr('max', max);
    }

    if (progress) {
        $('#progress-bar').attr('value', progress);

        if (progress >= max) {
            $('#progress-text').html(lang.Completed);

            $('#start-button').removeAttr('disabled');
        }
    }


}

function setTask(progressText) {

    $('#progress-bar').attr('value', 0);

    $('#progress-text').html(progressText);
}

function init() {
    setUserAddress();
}

function enablePasswordInput(enable = false) {
    console.log('Enabling', enable);
    $('#wallet-password').prop('disabled', !enable);
    $('#wallet-repeat-password').prop('disabled',! enable);
    if (enable) {
        $('#wallet-encrypt').removeClass('hidden');
        $('#wallet-encrypted').addClass('hidden');
    } else {
        $('#wallet-encrypt').addClass('hidden');
        $('#wallet-encrypted').removeClass('hidden');
    }

}

function setUserAddress() {

    getUserAddress(function (userAddress) {
        $('#user-address').html(userAddress);
    });
}

function encryptWallet() {

    let password = $('#wallet-password').val();
    let repeatPassword = $('#wallet-repeat-password').val();

    if (walletPassword) {
        modal.alert({
            message: lang.WalletEncrypted
        });
    } else {
        console.log(password, repeatPassword);
        if (password.length > 0 && repeatPassword.length > 0 && password === repeatPassword) {
            setTask(lang.EncryptingWallet);
            modal.loading();

            trantor.encryptWallet(password, function (err, result) {
                if (err) {
                    modal.error({
                        message: err.message
                    });

                    walletPassword = false;
                    setTask(err.message)
                } else {
                    walletPassword = password;
                    console.log('Wallet encrypted!', result);
                    enablePasswordInput(false);
                    Notifications.notify(lang.Wallet, lang.WalletEncrypted, './assets/img/notification/wallet.png', 3);
                    trantor.stop();
                    setTimeout(function () {
                        //TODO: Hide progress dialog encripting wallet
                        modal.hide();
                        startTrantor();
                    }, 1000 * 7);
                }
            })
        } else {
            modal.alert({
                message: lang['Passwords do not match']
            });
        }
    }
}

function initPlatform() {
    if (walletPassword) {
        fileStorage.setKey('firstUseExecuted', true);
        window.location.href = 'platform.html';
    } else{
        modal.alert({
            message: lang.EncryptWalletAlert
        });
    }
}

function createBackup() {
    let dialog = control.dialog;

    dialog.showSaveDialog(function (fileName) {
        console.log(fileName);
        if (fileName === undefined) {

        } else {
            let isTestnet = Constants.DEBUG;
            let walletPath = Constants.BIN_FOLDER + (isTestnet ? 'testnet3' + Constants.FILE_SEPARATOR : '') + 'wallet.dat';
            console.log(walletPath);
            File.cp(walletPath, fileName);
            Notifications.notify(lang.Backup, fileName, './assets/img/notification/wallet.png', 2);
        }
    })
}