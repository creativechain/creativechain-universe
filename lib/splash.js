
let fileStorage = FileStorage.load(CONSTANTS.APP_CONF_FILE);
let walletPassword;
let walletLocked = false;
let downloading = false;
let initialized = false;
let syncProcess;
let syncProcessHandled = false;
let coreLoaded = -1;
let showingWindowsNotif = false;
let windowsNotifTimeout = null;
let platformLoaded = false;

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

trantor.on('core.daemon.downloading', function (progress) {
    onSplash = true;
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

trantor.on('core.bootstrap.download', function () {
    console.log('Donwloading index.db');
    let credentials = FileStorage.load(CONSTANTS.CREDENTIALS_FILE);
    let url = credentials.getKey('base_url') + 'index.db';

    let downloadBootstrap = function (retry) {
        if (retry < 3) {
            File.download(url, CONSTANTS.DATABASE_FILE, null, function (err, file) {

                if (err) {
                    console.error(err);
                    setTimeout(function () {
                        downloadBootstrap(retry++);
                    }, 1000);
                } else {
                    console.log('index downloaded', file);
                    trantor.emit('core.bootstrap', file);
                }

            });
        } else {
            trantor.emit('core.bootstrap', CONSTANTS.DATABASE_FILE);
        }
    };

    downloadBootstrap(0);
});

trantor.on('core.started', function () {
    console.log('Trantor initialized!');
    trantor.ipfsrunner.send('close');
    startSynchronization();

    setTimeout(function () {
        checkWalletEncryption();
    }, 1000);

    if (!syncProcessHandled) {
        handleSyncProgress();
    }

});

trantor.on('core.notification', function (title, body, icon, duration) {

    if (OS.isWindows8Or10()) {
        showWinNotif(body, duration)
    } else {
        Notifications.notify(title, body, icon, duration);
    }

});

function showWinNotif(body, duration) {
    let winNotif = $('#win-notification');
    let winNotifText = $('#win-notification-text');
    let winNotifClose = $('#win-notification-close');

    let closeNotif = function () {
        winNotif.removeClass('efect-alert-footer');
        showingWindowsNotif = false;
    };

    if (showingWindowsNotif) {
        if (windowsNotifTimeout) {
            clearTimeout(windowsNotifTimeout);
        }
    }

    winNotifText.html(body);
    winNotifClose.unbind('click')
        .click(function () {
            closeNotif();
        });

    if (duration) {
        duration = duration * 1000;
        windowsNotifTimeout = setTimeout(function () {
            closeNotif();
        }, duration)
    }

    if (!showingWindowsNotif) {
        winNotif.addClass('efect-alert-footer');
        showingWindowsNotif = true;
    }
}

trantor.on('core.log', function () {
    console.log.apply(console, arguments);
});

function checkWalletEncryption(stop = 0) {
    //Checking if wallet.dat is encrypted
    trantor.rpcWallet.help(function (err, result) {
        if (err) {
            console.error(err);
            setTimeout(function () {
                checkWalletEncryption(++stop);
            }, 2000);
        } else {
            //console.log(result);
            modal.hide();
            if (result.indexOf('walletlock') >= 0 ) {
                walletLocked = true;
                if (!syncProcessHandled) {
                    handleSyncProgress();
                }
            }

            enablePasswordInput(!walletLocked)
        }
    })
}

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
        trantor.rpcWallet.getBlockchainInfo(function (err, result) {
            if (err) {
                console.error(err);
                if (err.code === 'ECONNREFUSED') {
                    //startTrantor();
                }
            } else {

                coreLoaded = 1;
                checkWalletEncryption();
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

            enablePasswordInput(false);
            walletPassword = password;
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
                    trantor.emit('core.notification', lang.Wallet, lang.WalletEncrypted, './assets/img/notification/wallet.png', 3);
                    trantor.stop(false);
                    syncProcessHandled = false;
                    setTimeout(function () {
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

        trantor.stop();
        modal.loading(lang.PleaseWait);
        setTimeout(function () {
            console.log('Changing href location');
            window.location.href = 'platform.html';
        }, 7000);
    } else{
        modal.alert({
            message: lang.EncryptWalletAlert
        });
    }
}

function createBackup() {
    let dialog = control.dialog;

    let name = 'wallet.dat';
    let title = String.format(lang.SaveFile, name);
    dialog.showSaveDialog(null, {
        title: title,
        defaultPath: name
    }, function (fileName) {
        if (fileName) {

            trantor.backupWallet(fileName, function (err, result) {
                if (err) {

                } else {
                    let notifBody = String.format(lang.FileCopied, fileName);
                    trantor.emit('core.notification', lang.Files, notifBody, './assets/img/notification/wallet.png', 10);
                }
            });
        }
    })
}

function loadWalletFile() {
    dialog.showOpenDialog((fileNames) => {
        if(fileNames){
            let walletFile = fileNames[0];
            $('#wallet-file').val(walletFile);

            modal.loading(lang.RestoringWallet);
            trantor.restoreWallet(walletFile, function (error) {
                if (error) {
                    console.error(error);
                } else {
                    modal.alert({
                        message: String.format(lang.FileLoadedCorrectly, walletFile)
                    });

                    modal.hide();

                    checkWalletEncryption(0);
                    handleSyncProgress();
                }
            });

        } else {
            console.log("No file selected");
        }
    })
}
