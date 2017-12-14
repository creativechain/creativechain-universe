
function inviteUser(address) {

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
        })
    });
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
        console.log(params, url);
        http.post({
            url: url,
            formData: params
        }, function (err, response, body) {
            let oauth = JSON.parse(body);
            let accessToken = oauth.access_token;
            let expiresIn = parseInt(oauth.expires_in) * 1000 + now;
            appConf.setKey('accessToken', accessToken);
            appConf.setKey('accessTokenExpiration', expiresIn);
            callCallback(accessToken);
        })
    }
}

function getUserAddress(callback) {
    trantor.client.getAddressesByAccount('user', function (err, result) {
        if (err) {
            console.error(err);
        } else {
            if (result.length > 0) {
                if (callback) {
                    console.log('user address', result[0]);
                    callback(result[0]);
                }
            } else {
                trantor.client.getAccountAddress('user', function (err, result) {
                    if (err) {
                        console.error(err);
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

function startTrantor() {
    trantor.start(function () {
        console.log('Trantor started!');

        trantor.explore();
        setInterval(function () {
            if (!trantor.isExploring) {
                trantor.explore();
            }
        }, 10 * 1000);
    });
}

startTrantor();
