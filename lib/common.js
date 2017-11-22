
function inviteUser(address) {

    getAccessToken(function (accessToken) {
        let params = {
            wallet: address
        };

        let headers = {
            'Authorization': 'Bearer ' + accessToken
        };

        http.post({
            url: Constants.INVITATION_API.ADD,
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
        let headers = {
            'Authorization': 'Bearer ' + accessToken
        };

        http.get({
            url: Constants.INVITATION_API.LIST,
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
    let time = appConf.getKey('accessTokenExpiration');
    let now = new Date().getTime();

    let callCallback = function (token) {
        if (callback) {
            callback(token);
        }
    };

    if (accessToken && now > time) {
        callCallback(accessToken);
    } else {
        let credentials = FileStorage.load(Constants.CREDENTIALS_FILE);
        let params = credentials.storage;
        params.grant_type = 'client_credentials';

        http.post({
            url: Constants.INVITATION_API.CREDENTIALS,
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
    let address = localStorage.getItem('userAddress');
    if (address) {
        if (callback) {
            callback(address);
        }
    } else {
        trantor.client.getAccountAddress('user', function (err, result) {
            if (err) {
                console.error(err);
            } else {
                address = result.result;
                localStorage.setItem('userAddress', address);
                inviteUser(address);
                if (callback) {
                    callback(address);
                }
            }
        })
    }
}

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
