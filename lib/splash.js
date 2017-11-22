
let fileStorage = FileStorage.load();
let walletPassword;
let downloading = false;
let initialized = false;
let syncProcess;
let coreLoaded = -1;

$(document).ready(function () {
    console.log('Document ready');

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
        console.log('to right', slide);
        slide = parseInt(slide);
        if (coreLoaded === -1 && slide === 5) {
            coreLoaded = 0;
            modal.loading({
                title: lang.LoadingResources
            })
        } else if (coreLoaded === 0 && slide === 6){
            return false
        } else if (slide === 9) {
            return false;
        }
    });

    $(document).keydown(function (event) {
        let element;
        console.log(event.which);
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

    if (progress > 100) {
        onSyncStart();
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
                result = result.result;
                if (result.indexOf('walletlock') >= 0 ) {
                    walletPassword = true;
                    disablePasswordInput();
                }
            }
        })
    };

    setTimeout(function () {
        checkWalletEncryption();
    }, 1000);

});

trantor.events.subscribe('onLog', 'splash', function (args) {
    console.log(args);
});

function onSyncStart() {
    if (!initialized) {
        setTask(lang.Synchronizing);
        syncProcess = setInterval(function () {
            handleSyncProgress();
        }, 100);
        initialized = true;
    }

    setTimeout(function () {
        init();
    }, 3000);
}


function handleSyncProgress() {

    trantor.client.getBlockchainInfo(function (err, result) {
        if (err) {
            console.error(err);
        } else {
            if (!coreLoaded) {
                modal.hide();
            }

            coreLoaded = 1;
            result = result.result;
            console.log('Blockchain sync', result.blocks + ' / ' + result.headers);
            setProgress(result.blocks, result.headers);

            if (result.blocks >= result.headers) {
                clearInterval(syncProcess);
            }
        }
    })
}

function setProgress(progress, max = 0) {

    if (max) {
        $('#progress-bar').attr('max', max);
    }

    if (progress) {
        $('#progress-bar').attr('value', progress);

        if (progress >= max) {
            $('#progress-text').html(lang.Completed)

            $('#start-button').removeAttr('disabled');
        }
    }


}

function setTask(progressText) {

    $('#progress-bar').attr('value', 0);

    $('#progress-text').html(progressText);
}

function init() {

    getUserAddress(function (userAddress) {
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
    });

}

function disablePasswordInput() {
    $('#wallet-password').prop('disabled', true);
    $('#wallet-repeat-password').prop('disabled', true);
    $('#wallet-encrypt').css('display', 'none');
    $('#wallet-encrypted').css('display', 'inherit');
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
        dialogs.alert(lang['WalletEncrypted']);
    } else {
        console.log(password, repeatPassword);
        if (password.length > 0 && repeatPassword.length > 0 && password === repeatPassword) {
            setTask(lang.EncryptingWallet);
            trantor.encryptWallet(password, function (err, result) {
                if (err) {
                    dialogs.alert(err.message);
                    walletPassword = true;
                    setTask(err.message)
                } else {
                    walletPassword = password;
                    console.log('Wallet encrypted!', result);
                    Notifications.notify(lang['Wallet'], lang['WalletEncrypted!'], './assets/img/wallet-alert.png', 3);
                    trantor.stop();
                    setTimeout(function () {
                        //TODO: Hide progress dialog encripting wallet
                        startTrantor();
                    }, 1000 * 7);
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
            let isTestnet = Constants.DEBUG;
            let walletPath = Constants.BIN_FOLDER + (isTestnet ? 'testnet3' + Constants.FILE_SEPARATOR : '') + 'wallet.dat';
            console.log(walletPath);
            File.cp(walletPath, fileName);
            Notifications.notify(lang['Backup'], fileName, './assets/img/wallet-alert.png', 2);
        }
    })
}