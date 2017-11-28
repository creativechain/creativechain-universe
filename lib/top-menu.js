
let reqPass = false;
let walletPassword = false;
trantor.events.subscribe('onTorrentError', 'top-menu', function (args) {
    let err = args[0];
    console.error('WebTorrent error', err);
});

trantor.events.subscribe('onStart', 'top-menu', function () {
    inputPassword();
    refreshUserData();

    setTimeout(function () {
        refreshTopBalance();
    }, 1500);

    trantor.database.getAllTorrents(function (err, result) {
        if (err) {
            console.error(err);
        } else {
            result.forEach(function (row) {
                let opts = {
                    path: row.path
                };

                torrentClient.seedFile(row.file, function (torrent) {
                    console.log('seeding file', row.file, torrent);
                })

            })
        }
    })

});

trantor.events.subscribe('onAfterRegister', 'main', function (args) {
    let txBuffer = args[0];
    let userReg = args[1];
    let torrent = args[2];

    let tx = DecodedTransaction.fromHex(txBuffer.toString('hex'));
    Notifications.notify(lang.RegistrationCompleted, lang.RegistrationCongrats, './assets/img/user.png', 10);
    trantor.database.addAuthor(userReg, tx, new Date().getTime(), function (result) {
        setTimeout(function () {
            refreshUserData();
            putUserData();
        }, 500);
    });
});

function refreshUserData() {

    getUserAddress(function (userAddress) {
        trantor.getUserData(userAddress, function (err, results) {
            if (err) {
                console.error(err);
            } else  if (results && results.length > 0) {
                let user = results[0];
                //console.log(user);
                $('#user-top-name').html(user.name);
                $('#user-publish-name').html(user.name);
                $('#user-publish-web').html(user.web || user.description);

                let buzz = BUZZ.getBuzz(user.likes, user.comments, user.publications, 0);
                $('#user-publish-level-icon').attr('src', buzz.icon);
                $('#user-publish-level').html(buzz.levelText);
                $('#user-publish-buzz').html(buzz.rate + ' Buzz');

                let avatar = resolveAvatar(user.avatarFile, userAddress, 120);
                $('#user-top-avatar').attr('src', avatar);
                $('#user-publish-avatar').attr('src', avatar);
            }
            //console.log(results);
        })
    });

}


function inputPassword() {
    console.log('Password requested', reqPass);
    if (!reqPass) {
        modal.password({
            title: lang.EnterPassword,
            ok: {
                onclick: function (password) {
                    if (password) {
                        autoSession(password);
                        refreshTopBalance();
                        refreshUserData();
                    } else {
                        inputPassword();
                    }
                }
            },
            cancel: {
                onclick: function () {
                    closeApp()
                }
            }
        });
    } else {
        autoSession(walletPassword);
    }
}

function autoSession(password) {
    let now = new Date().getTime();
    let sessionExpireTime = appStorage.getKey('sessionExpireTime', 0);
    let timeout = sessionExpireTime - now;
    timeout = parseInt(timeout / 1000);

    if (timeout > 0 && reqPass) {
        appStorage.setKey('passwordRequested', true);
        setTimeout(function () {
            autoSession(password);
        }, timeout * 1000);
    } else {
        trantor.client.walletPassPhrase(password, SESSION_DURATION_MILLIS / 1000, function (err, result) {
            if (err) {
                console.error(err);
                modal.alert({
                    message: err.message,
                    ok: {
                        onclick: function () {
                            reqPass = false;
                            inputPassword();
                        }
                    }
                });
            } else {
                console.log('Session started!');
                let sessionTime = new Date().getTime();
                sessionExpireTime = sessionTime + SESSION_DURATION_MILLIS;
                reqPass = true;
                walletPassword = password;
                appStorage.setKey('sessionTime', sessionTime);
                appStorage.setKey('sessionExpireTime', sessionExpireTime);
                setTimeout(function () {
                    autoSession(password);
                }, SESSION_DURATION_MILLIS);
            }
        });
    }
}


function refreshTopBalance() {
    let balance = {};
    trantor.client.getBalance('*', 0, function (err, result) {
        let amount = result.result * Math.pow(10, 8);
        balance.total = new CreativeCoin(amount);
        $('#top-balance').html(balance.total.toString());
        $('#top-balance-tooltip').attr('title', balance.total.toString());
    });
}

function performSearch(words) {
    onSearch = true;
    if (!words) {
        words = $('#content-search').val();
        words.replace(' ', ',');
    }

    words = words.split(',');
    console.log(words);
    trantor.searchByTags(words, function (result) {
        console.log(result);
        showSearch(result);
    });
}

function onSearchText(e) {
    if (e.keyCode === 13 || e.keyCode === 10) { //Enter Key
        performSearch();
    } else {
        let val = $('#content-search').val();
        if (!val || val.length === 0) {
            onSearch = false;
            loadAllMedia();
        }
    }

    return true;
}