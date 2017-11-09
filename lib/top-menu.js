
/*let rawTx = '0100000001aecd1f5e6ce8c880065ad48172cd2e6d3a3b1d26a7af89dcf93179b99d2e1583010000006a47304402203e8538b6afd606ba3ccf23131ec2662d43391bfc9989787fc679468db007ab080220118ca9979f21d28cd596cfc555dfe8159c65160d2eff697e82271661e5e92082012102e21cd30d858db453448cde58c4529ac5d92f5ddb19c2e9e65dffe64d927bb2aeffffffff020000000000000000fd54016a4d5001b8015d00000002320200000000000000007ffe416cc4e2ef517a49881708e54c882a92dd7b3a61a791e1d3d81680a86a776110b33d632dec24d6dd08b50142bdbf59e596e50a7b70cc70ea4caf31336311eaa25efc9582eadbc700a33fd8b3679c66af8f189b8bb206c002261f44fddec9a73429282c76bce407b4c9233d795cdc32165ad88cf36c8dcd208a42c704ea9afdd75af8d44b53892cadde27d18d2ae24d8e80467449cebc9b2aa756aa9010edd6a33d210ae5d55d96d4479ab0a49746d92639e67f7c6d9dcde5e1b8ff7ee89fbb637e39131ed4fec865b1493a8040acd515607e2394822c2cd73b591d55896248d87ecfc686419937f28c344c4c134122ef5b769168fa367338d582351df92f6bcb377e106c7302bf9ab22a69c827a442db7997f47078499a41bf8bd9e282be86b1f2c7691a49913e928640d205605822ace17dab6282b22f5fff9f99d000537df804000000001976a9143a41af0b523380667f170c70469178cdd29941e688ac00000000';
let tx = DecodedTransaction.fromHex(rawTx);
let data = tx.getData();
console.log(data, tx, tx.containsData());*/

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
    let userReg = args[0];
    let torrent = args[1];

    let tx = DecodedTransaction.fromHex(txBuffer.toString('hex'));
    Notifications.notify(lang.RegistrationCompleted, lang.RegistrationCongrats, './assets/img/user.png', 10);
    trantor.database.addAuthor(userReg, tx, new Date().getTime(), function (result) {
        setTimeout(function () {
            refreshUserData();
        }, 500);
    });
});

function refreshUserData() {
    let userAddress = localStorage.getItem('userAddress');
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

            let avatar = resolveAvatar(user.avatarFile, user.address, 120);
            $('#user-top-avatar').attr('src', avatar);
            $('#user-publish-avatar').attr('src', avatar);
        }
        //console.log(results);
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