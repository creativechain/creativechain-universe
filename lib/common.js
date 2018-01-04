let invited = false;
let startTimeout = null;
/**
 *
 * @returns {string}
 */
function getClipboardText() {
    return clipboard.readText();
}

function inviteUser(address) {

    if (!invited) {
        getAccessToken(function (accessToken) {
            let credentials = FileStorage.load(Constants.CREDENTIALS_FILE);
            credentials = credentials.storage;

            let params = {
                wallet: address
            };

            let headers = {
                'Authorization': 'Bearer ' + accessToken
            };

            let url = credentials.base_url + credentials.endpoints.ADD;
            http.post({
                url: url,
                formData: params,
                headers: headers
            }, function (err, result, body) {
                console.log(result);
                invited = true;
            })
        });
    }

}

function invitationList(callback) {

    let callCallback = function (list) {
        if (callback) {
            callback(list);
        }
    };

    getAccessToken(function (accessToken) {
        let credentials = FileStorage.load(Constants.CREDENTIALS_FILE);
        credentials = credentials.storage;

        let headers = {
            'Authorization': 'Bearer ' + accessToken
        };

        let url = credentials.base_url + credentials.endpoints.LIST;
        http.get({
            url: url,
            headers: headers
        }, function (err, result, body) {
            console.log(result);
            let list = JSON.parse(body);
            callCallback(list.data);
        });
    });

}

function getAccessToken(callback) {
    let appConf = FileStorage.load();
    let accessToken = appConf.getKey('accessToken');
    let time = appConf.getKey('accessTokenExpiration', 0);
    let now = new Date().getTime();

    let callCallback = function (token) {
        if (callback) {
            callback(token);
        }
    };

    if (accessToken && now < time) {
        callCallback(accessToken);
    } else {
        let credentials = FileStorage.load(Constants.CREDENTIALS_FILE);
        let params = {
            client_id: credentials.getKey('client_id'),
            client_secret: credentials.getKey('client_secret'),
            grant_type: 'client_credentials'
        };

        credentials = credentials.storage;

        let url = credentials.base_url + credentials.endpoints.CREDENTIALS;
        //console.log(params, url);
        http.post({
            url: url,
            formData: params
        }, function (err, response, body) {
            if (err) {
                console.error(err)
            } else {
                let oauth = JSON.parse(body);
                let accessToken = oauth.access_token;
                let expiresIn = parseInt(oauth.expires_in) * 1000 + now;
                appConf.setKey('accessToken', accessToken);
                appConf.setKey('accessTokenExpiration', expiresIn);
                callCallback(accessToken);
            }

        })
    }
}

function getUserAddress(callback, retries = 0) {
    trantor.client.getAddressesByAccount('user', function (err, result) {
        if (err) {
            //console.error(err);
            if (retries < 5) {
                setTimeout(function () {
                    getUserAddress(callback, retries++);
                }, 100);
            }
        } else {
            if (result.length > 0) {
                if (callback) {
                    //console.log('user address', result[0]);
                    let address = result[0];
                    inviteUser(address);
                    callback(address);
                }
            } else {
                trantor.client.getAccountAddress('user', function (err, result) {
                    if (err) {
                        console.error(err);
                        if (retries < 5) {
                            setTimeout(function () {
                                getUserAddress(callback, retries++);
                            }, 100);
                        }
                    } else {
                        let address = result;
                        inviteUser(address);
                        if (callback) {
                            callback(address);
                        }
                    }
                })
            }
        }
    })

}

trantor.events.subscribe('onInternetError', 'common', function () {
    modal.error({
        message: lang.InternetError
    })
});

function detectScrollBottom(event) {
    console.log('Scrolling')
    let scrollHeight = $(document).height();
    let scrollPosition = $(window).height() + $(window).scrollTop();
    if ((scrollHeight - scrollPosition) / scrollHeight === 0) {
        // when scroll to bottom of the page
        console.log('Scroll bottom detected!');
        loadMorePage();
    }
}

function startTrantor() {
    startTimeout = setTimeout(function () {
        startTrantor();
    }, 5 * 1000);

    trantor.start(function () {

        let fileStorage = FileStorage.load();
        let explore = fileStorage.getKey('firstUseExecuted', false);
        console.log('Trantor started! Explore', explore);

        if (explore) {
            trantor.explore();
            setInterval(function () {
                if (!trantor.isExploring) {
                    trantor.explore();
                }
            }, 10 * 1000);
        }
    });
}

trantor.events.subscribe('onStart', 'common', function () {
    if (startTimeout) {
        clearTimeout(startTimeout)
    }
});

startTrantor();
