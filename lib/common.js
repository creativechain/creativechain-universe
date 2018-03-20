let invited = false;
let startTimeout = null;

/**
 *
 * @returns {string}
 */
function getClipboardText() {
    return clipboard.readText();
}

function httpPostCall(url, params, callback) {
    getAccessToken(function (accessToken) {

        http.post({
            url: url,
            headers: {
                Authorization: 'Bearer ' + accessToken
            },
            formData: params
        }, callback);
    });
}

function inviteUser(address) {

    if (!invited) {
        let credentials = FileStorage.load(Constants.CREDENTIALS_FILE);
        credentials = credentials.storage;

        let params = {
            wallet: address
        };

        let url = credentials.base_url + credentials.endpoints.ADD;

        httpPostCall(url, params, function (err, result, body) {
            invited = true;
        });
    }

}

/**
 *
 * @param {string} contentAddress
 * @param {string} content
 * @param callback
 */
function encryptContent(contentAddress, content, callback) {
    let credentials = FileStorage.load(Constants.CREDENTIALS_FILE);
    credentials = credentials.storage;

    let params = {
        address: contentAddress,
        content: content
    };

    let url = credentials.base_url + credentials.endpoints.SECRET_CONTENT;

    httpPostCall(url, params, function (err, response, body) {
        if (err) {
            console.error(err);
            callback();
        } else {
            callback(JSON.parse(body).data);
        }
    });
}

/**
 *
 * @param {string} contentAddress
 * @param {string} encryptedContent
 * @param {string} txId
 * @param callback
 */
function decryptContent(contentAddress, encryptedContent, txId, callback) {
    getUserAddress(function (userAddress) {
        trantor.client.signMessage(userAddress, txId, function (err, signature) {
            if (err) {
                console.error(err);
            } else {
                let credentials = FileStorage.load(Constants.CREDENTIALS_FILE);
                credentials = credentials.storage;

                let params = {
                    content: contentAddress,
                    authoraddress: userAddress,
                    txid: txId,
                    signedtx: encryptedContent
                };

                let url = credentials.base_url + credentials.CHECK_CONTENT;
                httpPostCall(url, params, function (err, response, body) {
                    if (err) {
                        console.error(err);
                        callback();
                    } else {
                        let data = JSON.parse(body);
                        callback(data.content);
                    }
                })
            }
        })
    })
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

trantor.events.on('onInternetError', function () {
    modal.error({
        message: lang.InternetError
    })
});

function detectScrollBottom(event) {

    let scrollHeight = $(document).height();
    let scrollPosition = $(window).height() + $(window).scrollTop();
    if ((scrollHeight - scrollPosition) / scrollHeight === 0) {
        // when scroll to bottom of the page
        console.log('Scroll bottom detected!');
        loadMorePage();
    }
}

/**
 *
 * @param {string} walletFile
 * @param {string} indexFile
 * @param {number} version
 * @param callback
 */
function encodeUserData(walletFile, indexFile, version, callback) {
    let wallet, index;

    let compressIndex = function () {
        if (File.exist(indexFile)) {
            let compressed = File.read(indexFile, null);
            Utils.compress(compressed, 9, function (result, error) {
                index = {
                    data: result.toString('hex'),
                    size: result.length
                };

                let varint = require('varint');

                let data = ContentData.serializeNumber(version, 2);
                data += ContentData.serializeText(Buffer.from(wallet.data, 'hex').toString());
                data += ContentData.serializeText(Buffer.from(index.data, 'hex').toString());

                callback(Buffer.from(data, 'hex'));
            });

        } else {
            callback(false);
        }

    };

    if (File.exist(walletFile)) {
        let compressed = File.read(walletFile, null);
        Utils.compress(compressed, 9, function (result, error) {
            wallet = {
                data: result.toString('hex'),
                size: result.length
            };

            compressIndex();
        });

    } else {
        callback(false);
    }
}

/**
 *
 * @param {string/Buffer} data
 * @return {{version: (Number|number), wallet: Buffer, index: Buffer}}
 */
function decodeUserData(data) {

    if (typeof data === 'string') {
        data = Buffer.from(data, 'hex');
    }

    let offset = 0;
    let version = data.readUInt16BE(offset);
    offset += 2;

    let walletData = ContentData.deserializeText(data, offset);
    offset += walletData.offset2;
    console.log(walletData.offset, data.length);

    let indexData = ContentData.deserializeText(data, walletData.offset);


    return {
        version: version,
        wallet: Utils.decompress(Buffer.from(walletData.text)),
        index: Utils.decompress(Buffer.from(indexData.text))
    };
}

function handleRpcError(err, hideModal = false) {
    if (hideModal) {
        modal.hide();
    }

    let message = err.message;
    if (lang[err.code]) {
        message = lang[err.code];
    }

    modal.error({
        message: err.message
    });

    console.error(err);
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

trantor.events.on('onStart', function () {
    if (startTimeout) {
        clearTimeout(startTimeout)
    }

    let onGetTransactions = function () {
        trantor.client.listTransactions('user', 99999, function (err, result) {
            if (err) {
                if (err.code === -28) {
                    setTimeout(function () {
                        onGetTransactions();
                    }, 500);
                } else {
                    console.error(err);
                }
            } else if (result.length > 0) {
                let registerTx = result[0];
                console.log('Setting register time', registerTx.time);
                BUZZ.REGISTER_TIME = parseInt(registerTx.time);
            } else {
                console.error('Register time not found');
                BUZZ.REGISTER_TIME = 0;
            }
        })
    };

    onGetTransactions();
});

startTrantor();
