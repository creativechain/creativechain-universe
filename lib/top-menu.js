
let sessionTimeout = null;
let walletPassword = false;
let searches = [];
let searchIndex = -1;

let userSearchList = null;

trantor.events.on('onStart', function () {
    inputPassword();
    refreshUserData();

    setTimeout(function () {
        refreshTopBalance();
    }, 1500);

});

trantor.events.on('onAfterRegister', function (txBuffer, userReg, torrent) {
    let tx = DecodedTransaction.fromHex(txBuffer.toString('hex'));

    //TODO: Show default user avatar as notification icon
    let avatar = resolveAvatar(userReg.avatar, userReg.address);

    trantor.database.getAuthor(userReg.address, 'a', function (err, result) {
        if (err || result.length === 0) {
            Notifications.notify(lang.RegistrationCompleted, lang.RegistrationCongrats, avatar, 10);
        } else {
            Notifications.notify(lang.ProfileUpdated, lang.YourProfileUpdated, avatar, 10);
        }

        trantor.database.addAuthor(userReg, tx, new Date().getTime(), function (result) {
            setTimeout(function () {
                refreshUserData();
                loadProfile(userReg.address);
            }, 500);
        });
    })


});

function refreshUserData() {

    getUserAddress(function (userAddress) {
        trantor.getUserData(userAddress, userAddress, function (err, results) {
            let avatar = resolveAvatar(null, userAddress);
            let name = lang.Anonymous;
            if (err) {
                console.error(err);
            } else  if (results && results.length > 0) {
                let user = results[0];
                //console.log(user);

                $('#user-publish-web').html(user.web || user.description);

                let buzz = BUZZ.getBuzz(user.likes, user.comments, user.publications, 0);
                $('#user-publish-level-icon').attr('src', buzz.icon);
                $('#user-publish-level').html(buzz.levelText);
                $('#user-publish-buzz').html(buzz.rate + ' Buzz');
                avatar = resolveAvatar(user.avatarFile, userAddress);
                name = user.name || userAddress;
            }
            //console.log(results);

            $('#user-top-avatar').attr('src', avatar);
            $('#user-publish-avatar')
                .unbind('click')
                .click(function () {
                    showProfileView();
                })
                .attr('src', avatar);
            $('#user-top-name').html(name);
            $('#user-publish-name')
                .unbind('click')
                .click(function () {
                    showProfileView();
                })
                .html(name);
        })
    });

}

function hideModalPass() {
    console.log('Hidding modal password');
    let modal = $('#modal-pass');
    modal.modal('hide');
}

function showDialogPass(title = langEnterPassword) {
    console.log('Showing modal password');
    $('#modal-pass-title').html(title);
    let modal = $('#modal-pass');



    let passTimeout = setTimeout(function () {
        console.error('Modal pass not shown. Trying again...');
        inputPassword();
    }, 3000);

    modal.on('show.bs.modal', function () {
        console.log('MODAL SHOW EVENT!');
        clearTimeout(passTimeout);
    });

    modal.modal({
        backdrop: 'static',
        keyboard: false
    });

    $('#modal-pass-password').keydown(function (event) {
        //console.log('Key', event.which);
        if (event.which === 13) {
            acceptPass();
            return false;
        }
    })
};

function acceptPass() {
    let password = $('#modal-pass-password').val();
    hideModalPass();
    if (password) {
        startSession(password);
        refreshTopBalance();
        refreshUserData();
    } else {
        inputPassword();
    }
}

function inputPassword(message = lang.EnterPassword) {
    console.log('Password requested', reqPass);
    if (!reqPass) {
        showDialogPass(message);
    } else {
        startSession(walletPassword);
    }
}

function startSession(password, retries = 0) {
    trantor.client.walletPassphrase(password, /*SESSION_DURATION_MILLIS / 1000*/ 10, function (err, result) {
        //console.log(result);
        if (err) {
            modal.hide();
            console.error(err);
            if (err.code === -14) {
                setTimeout(function () {
                    console.log('Retrying password');
                    inputPassword(lang.IncorrectPassword);
                }, 200);
            } else if (err.code === -15) {
                trantor.encryptWallet(password, function (err, result) {
                    if (err) {
                        console.error(err);
                        modal.error({
                            message: err.message,
                        });
                    } else {
                        modal.loading();
                        trantor.stop(function () {
                            setTimeout(function () {
                                startSession(password);
                            }, 1000 * 5);
                        });
                    }
                });
            } else if (retries >= 5) {
                modal.error({
                    message: err.message,
                    ok: {
                        onclick: function () {
                            inputPassword();
                        }
                    }
                });
            } else {
                setTimeout(function () {
                    startSession(password, retries++);
                }, 200);
            }

        } else {
            trantor.client.walletLock();
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
            modal.hide();
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
function search(tag) {
    $('#content-search').val(tag);
    let event = {
        keyCode: 13
    };
    onSearchKey(event);
    $('#modal-article').modal('hide');
}

function addSearch(search) {
    let index = searches.indexOf(search);

    if (index === -1) {
        searches.push(search);
        searchIndex = searches.length - 1;
    }
}

function backSearch() {
    if (searchIndex > 0) {
        searchIndex -= 1;
    }

    search(searches[searchIndex]);
}

function nextSearch() {
    if (searchIndex < searches.length -1) {
        searchIndex += 1;
    }

    search(searches[searchIndex]);
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

    let wordsSearch = words.replace(' ', ',');

    getUserAddress(function (userAddress) {
        console.log(wordsSearch);
        let drp = $('#user-search-list');
        if (wordsSearch.startsWith('@')) {
            //Searching users

            wordsSearch = wordsSearch.split(',');
            console.log('Searching users', wordsSearch);
            let tags = [];
            wordsSearch.forEach(function (w) {
                if (w.startsWith('@')) {
                    w = w.substring(1, w.length); //Delete @ character
                }

                if (!w.isEmpty()) {
                    tags.push(w);
                }
            });

            if (tags.length > 0) {
                drp.dropdown('toggle');
                trantor.database.getAuthorsByTags(tags, userAddress, function (err, result) {
                    if (err) {
                        console.error(err);
                    } else {
                        if (!userSearchList) {
                            userSearchList = new Vue({
                                el: '#user-search-list',
                                data: {
                                    authors: result,
                                    userAddress: userAddress,
                                    lang: lang
                                },
                                methods: {
                                    resolveAvatar: function (file, address) {
                                        return resolveAvatar(file, address);
                                    },
                                    loadProfileData(address, isUser) {
                                        loadProfileData(address, isUser);
                                        showProfileView();
                                    }
                                }
                            })
                        } else {
                            userSearchList.$data.authors = result;
                        }
                    }
                })
            } else {
                drp.parent().removeClass('open');
                if (!userSearchList) {
                    userSearchList = new Vue({
                        el: '#user-search-list',
                        data: {
                            authors: [],
                            userAddress: userAddress,
                            lang: lang
                        },
                        methods: {
                            resolveAvatar: function (file, address) {
                                return resolveAvatar(file, address);
                            },
                            loadProfileData(address, isUser) {
                                loadProfileData(address, isUser);
                                showProfileView();
                            }
                        }
                    })
                } else {
                    userSearchList.$data.authors = [];
                }
            }


        } else {
            drp.parent().removeClass('open');
            wordsSearch = wordsSearch.split(',');
            let tags = [];
            wordsSearch.forEach(function (w) {
                if (w.startsWith('#')) {
                    w = w.substring(1, wordsSearch.length); //Delete @ character
                }

                tags.push(w);
            });

            trantor.searchByTags(tags, userAddress, function (err, result) {
                if (!err) {
                    console.log(result);
                    addSearch(words);
                    showExploreView();
                    showSearch(result, userAddress);
                }

            });
        }
    })
}

function onSearchKey(e) {
    /**
     *
     * @type {string}
     */
    let val = $('#content-search').val();

    if (e.keyCode === 13 || e.keyCode === 10 || val.startsWith('@')) { //Enter Key
        performSearch(val);
    } else {

        console.log('Search', val, val.isEmpty());
        let drp = $('#user-search-list');
        drp.parent().removeClass('open');
        if (val.isEmpty()) {
            console.log('loadingAllMedia');
            mustReloadContent = true;
            onSearch = false;
            loadAllMedia();
        }
    }

    return true;
}

