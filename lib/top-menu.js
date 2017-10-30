
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

                trantor.seedFile(row.file, function (torrent) {
                    console.log('seeding file', row.file);
                })

            })
        }
    })

});

function refreshUserData() {
    let userAddress = localStorage.getItem('userAddress');
    trantor.getUserData(userAddress, function (err, results) {
        if (err) {
            console.error(err);
        } else  if (results && results.length > 0) {
            let user = results[0];
            $('#user-top-name').html(user.name);

            let avatar = resolveAvatar(user.avatarFile, user.address, 80);
            $('#user-top-avatar').attr('src', avatar);
        }
        console.log(results);
    })
}


function inputPassword() {
    let reqPass = sessionStorage.getKey('passwordRequested', false);
    if (!reqPass) {
        dialogs.prompt(lang['EnterPassword'], null, function (password) {
            if (password === undefined) { // Canceled
                window.close();
            } else if (password) {
                autoSession(password);
                refreshTopBalance();
                refreshUserData();
            } else {
                inputPassword();
            }
        })
    } else {
        autoSession(localStorage.getItem('walletPassword'));
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
        }, timeout * 1000);
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
                localStorage.setItem('walletPassword', password);
                sessionStorage.setKey('sessionTime', sessionTime);
                sessionStorage.setKey('sessionExpireTime', sessionExpireTime);
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
        words.replace(' ', '+');
    }

    words = words.split('+');
    console.log(words);
    trantor.searchByTags(words, function (result) {
        console.log(result);
        loadMediaItems(result);
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