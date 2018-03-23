
let fileStorage = FileStorage.load();
let walletPassword;
let walletLocked = false;
let downloading = false;
let initialized = false;
let syncProcess;
let syncProcessHandled = false;
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
        console.log('to right', slide, coreLoaded);
        slide = parseInt(slide);
        if (coreLoaded === -1 && slide === 5) {
            coreLoaded = 0;
            modal.loading(lang.CreatingWallet)
        } else if ((coreLoaded === 0 || !walletLocked) && slide === 6){
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

trantor.events.on('onDaemonDownload', function (progress) {
    if (!downloading) {
        setTask(lang.DownloadingResources);
        downloading = true;
    }

    $('#progress-bar').attr('value', progress);

    console.log('Downloading daemon', progress);
    if (progress >= 100) {
        startSynchronization();
        enablePasswordInput(true);
    }

});

trantor.events.on('onStart', function () {
    console.log('Trantor initialized!');
    startSynchronization();

    let checkWalletEncryption = function (stop = 0) {
        //Checking if wallet.dat is encrypted
        trantor.client.help(function (err, result) {
            if (err) {
                console.error(err);
                setTimeout(function () {
                    checkWalletEncryption(++stop);
                }, 2000);
/*                if (err.code === 'ECONNREFUSED') {
                    if (stop >= 15) {
                        stop = 0;
                        trantor.stop();
                    }

                    setTimeout(function () {
                        trantor.start();
                        checkWalletEncryption(++stop);
                    }, 2000);
                } else {

                }*/

            } else {
                //console.log(result);
                if (result.indexOf('walletlock') >= 0 ) {
                    walletLocked = true;
                }
            }
        })
    };

    setTimeout(function () {
        checkWalletEncryption();
    }, 1000);

    enablePasswordInput(!walletLocked);

    if (!syncProcessHandled) {
        handleSyncProgress();
    }

});

trantor.events.on('onLog', function () {
    console.log.apply(console, arguments);
});

function startSynchronization() {
    if (!initialized) {
        setTask(lang.Synchronizing);
        handleSyncProgress();
        initialized = true;
    }

    setTimeout(function () {
        getUserAddress(function (userAddress) {
            $('#user-address').html(userAddress);
        });
    }, 3000);
}


function handleSyncProgress() {

    let onSync = function () {
        syncProcessHandled = true;
        trantor.client.getBlockchainInfo(function (err, result) {
            if (err) {
                console.error(err);
                if (err.code === 'ECONNREFUSED') {
                    //startTrantor();
                }
            } else {
                if (!coreLoaded) {
                    modal.hide();
                }

                enablePasswordInput(!walletLocked);
                coreLoaded = 1;
                //console.log(result);
                console.log('Blockchain sync', result.blocks + ' / ' + result.headers);
                setTask(lang.Synchronizing);
                setProgress(result.blocks, result.headers);

                if (parseInt(result.blocks) >= parseInt(result.headers)) {
                    clearInterval(syncProcess);
                }
            }
        });
    };


    syncProcess = setInterval(function () {
        onSync();
    }, 1000);
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

function encryptWallet() {

    let password = $('#wallet-password').val();
    let repeatPassword = $('#wallet-repeat-password').val();

    if (walletLocked) {
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
                message: lang['PasswordsNotMatch']
            });
        }
    }
}

function initPlatform() {
    if (walletLocked) {
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

    let isTestnet = Constants.DEBUG;
    let walletPath = Constants.BIN_FOLDER + (isTestnet ? 'testnet3' + Constants.FILE_SEPARATOR : '') + 'wallet.dat';
    let name = File.getName(walletPath);
    let title = String.format(lang.SaveFile, name);
    dialog.showSaveDialog(null, {
        title: title,
        defaultPath: name
    }, function (fileName) {
        if (fileName) {
            setTimeout(function () {
                File.cp(walletPath, fileName);
                let notifBody = String.format(lang.FileCopied, fileName);
                Notifications.notify(lang.Files, notifBody, './assets/img/notification/wallet.png', 10);
            }, 10)
        }
    })
}

function loadWalletFile() {
    dialog.showOpenDialog((fileNames) => {
        if(fileNames){
            let walletFile = fileNames[0];
            $('#wallet-file').val(walletFile);

            let destFile = Constants.WALLET_FOLDER + 'wallet.dat';

            trantor.stop();
            File.mkpath(destFile, true);
            File.cp(walletFile, destFile);

            setTimeout(function () {
                trantor.start();
            }, 2000)

            modal.alert({
                message: String.format(lang.FileLoadedCorrectly, walletFile)
            })
        } else {
            console.log("No file selected");
        }
    })
}

/*
function loadWalletFile() {
    dialog.showOpenDialog({
        title: lang.SelectUserFile,
        filters: [
            {name: 'Creativechain User File', extensions: ['crea']}
        ]
        }, function (fileNames) {
            if(fileNames){
                let userFile = fileNames[0];
                $('#wallet-file').val(userFile);

                let fileBuffer = File.read(userFile, null);
                let data = decodeUserData(fileBuffer);

                trantor.stop();
                File.cp(Constants.WALLET_FILE, Constants.WALLET_FILE + '.backup');
                File.write(Constants.WALLET_FILE, data.wallet.toString());
                File.write(Constants.DATABASE_FILE, data.index.toString());
                trantor.start();
            } else {
                console.log("No file selected");
            }

        }

    )
}*/
