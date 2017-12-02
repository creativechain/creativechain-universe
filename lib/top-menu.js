
let sessionTimeout = null;
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
            //console.log(result);
            result.forEach(function (row) {

                torrentClient.addFile(row.path, row.file, row.magnet);
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
            loadProfile();
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
                        startSession(password);
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
        startSession(walletPassword);
    }
}

function startSession(password) {
    trantor.client.walletPassphrase(password, SESSION_DURATION_MILLIS / 1000, function (err, result) {
        //console.log(result);
        if (err) {
            console.error(err);
            modal.error({
                message: err.message,
                ok: {
                    onclick: function () {
                        inputPassword();
                    }
                }
            });
        } else {
            console.log('Session started!');
            reqPass = true;
            walletPassword = password;
            if (sessionTimeout) {
                clearTimeout(sessionTimeout)
            }

            sessionTimeout = setTimeout(function () {
                startSession(password);
            }, SESSION_DURATION_MILLIS);

            enableSessionControl();
        }
    });
}


function refreshTopBalance() {
    let balance = {};
    trantor.client.getBalance('*', 0, function (err, result) {
        //console.log(result);
        let amount = result * Math.pow(10, 8);
        balance.total = new CreativeCoin(amount);
        $('#top-balance').html(balance.total.toString());
        $('#top-balance-tooltip').attr('title', balance.total.toString());
    });
}

/**
 *
 * @param {string} tag
 */
function searchTag(tag) {
    $('#content-search').val(tag);
    let event = {
        keyCode: 13
    };
    onSearchKey(event);
}
/**
 *
 * @param {string} words
 */
function performSearch(words) {
    onSearch = true;
    if (!words) {
        words = $('#content-search').val();
    }

    words = words.replace(' ', ',');
    words = words.split(',');
    console.log(words);
    trantor.searchByTags(words, function (err, result) {
        console.log(result);
        showExploreView();
        showSearch(result);
    });
}

function onSearchKey(e) {
    /**
     *
     * @type {string}
     */
    let val = $('#content-search').val();

    if (e.keyCode === 13 || e.keyCode === 10) { //Enter Key
        performSearch(val);
    } else {

        console.log('Search', val, val.isEmpty());

        if (val.isEmpty()) {
            console.log('loadingAllMedia');
            mustReloadContent = true;
            onSearch = false;
            loadAllMedia();
        }
    }

    return true;
}