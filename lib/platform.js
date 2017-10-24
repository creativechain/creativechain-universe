const {File} = require('./lib/trantor');

let itemList = $('#content-list');
let publicationLoader = $('#publication-items');
let followList = $('#following-list');
let followLoader = $('#follows-items');


let onSearch = false;

trantor.events.onExploreProgress = function (total, current) {
    console.log(total, current, (current * 100 / total) + '%')
};

trantor.events.subscribe('onExploreFinish', 'main', function (blockCount) {
    console.log('Trantor exploration process finished');
    setTimeout(function () {
        trantor.explore(blockCount);
        loadUserThatFollows()
    }, 60 * 1000);
});

/**
 *
 * @param {TransactionBuilder} txBuilder
 * @param {Array} spendables
 */
trantor.events.subscribe('onBeforeTransactionSend', 'index',function (txBuilder, spendables) {
    let t = '';
    let txMessage = String.format(lang['TxSendMessage'], Coin.parseCash(txBuilder.getFee(), 'CREA').toString());
    let send = confirm(txMessage);

    if (send) {
        let onSign = function () {
            trantor.signTransaction(txBuilder, spendables, function (err, txHex) {
                if (err) {
                    let passphrase = prompt(lang['EnterWalletPassphrase']);
                    trantor.decryptWallet(passphrase, 10, function (err, result) {
                        if (err) {

                        } else {
                            localStorage.setItem('password', passphrase);
                        }
                    })
                }
                trantor.sendRawTransaction(txHex, function (err, result) {

                })
            })
        }
    }
});

/**
 *
 * @param {DecodedTransaction} tx
 */
trantor.events.subscribe('onAfterTransactionSend', 'main',function (tx) {
    Notifications.notify(lang['TransactionSend'], tx.hash, './assets/img/wallet-alert.png', 2);
});

trantor.events.subscribe('onStart', 'main', function () {
    setTimeout(function () {
        init();
    }, 3000);
});

function init() {
    console.log('QueryUrl:', window.location.href);
    let searchValue = Utils.getQueryValue(window.location.href, 'search');
    if (searchValue) {
        search(searchValue);
    } else {
        loadAllMedia();
    }
}

function prependItem(txId) {
    if (!onSearch) {
        trantor.database.getMediaByContentId(txId, function (result) {
            if (result) {
                result = result[0];
                loadContentItem(result, true)
            }
        })
    }
}

/**
 *
 * @param {Array} items
 * @param {boolean} prepend
 */
function loadContentItems(items, prepend = false) {
    itemList.html('');
    if (items) {
        items.forEach(function (item) {
            loadContentItem(item, prepend);
        })
    }
}

function loadContentItem(data, prepend = false) {
    publicationLoader.load('./elements/content-item.html', function () {
        $('#content-item-title-').html(data.title).attr('id', 'content-item-title-' + data.address);
        $('#content-item-description-').html(data.description).attr('id', 'content-item-description-' + data.address);
        $('#content-item-like-count-').html(data.likes).attr('id', 'content-item-like-count-' + data.address);
        $('#content-item-comments-').html(data.comments).attr('id', 'content-item-comments-' + data.address);

        let item = publicationLoader.html();
        if (prepend) {
            itemList.prepend(item);
        } else {
            itemList.append(item);
        }

        publicationLoader.html('');
    });
}

/**
 *
 * @param {string} title
 * @param {string} description
 * @param {string} contentType
 * @param {number} contentType
 * @param {number} license
 * @param {Array} tags
 * @param {string} publicFile
 * @param {string} privateFile
 * @param {number} price
 */
function makePost(title, description, contentType, license, tags, publicFile, privateFile, price) {
    trantor.publish(title, description, contentType, license, tags, publicFile, privateFile, price)
}

function loadAllMedia() {
    if (!onSearch) {
        trantor.database.getAllMedia(function (err, result) {
            console.log(result);

            result.forEach(function (row) {
                loadContentItem(row);
            })
        });
    }
}

function loadUserThatFollows() {
    let userAddress = localStorage.getItem('userAddress');
    trantor.database.getUserFollowing(userAddress, function (err, result) {

        if (err) {
            console.error('Error', err);
        } else {
            console.log(result);
            result.forEach(function (user) {
                loadUserFollows(user, true);
            })
        }

    })
}

function loadUserFollows(data, prepend = false) {
    console.log('Loading following', data);
    followLoader.load('./elements/following-item.html', function () {
        let avatar = File.exist(data.avatarFile) ? data.avatarFile : 'https://api.adorable.io/avatars/40/'+ data.address;
        $('#follower-avatar-').attr('src', avatar).attr('id', 'follower-avatar-' + data.address);
        $('#follower-name-').html(data.name).attr('id', 'follower-name-' + data.address);
        $('#follower-description-').html(data.description).attr('id', 'follower-name-' + data.address);

        let item = followLoader.html();
        if (prepend) {
            followList.prepend(item);
        } else {
            followList.append(item);
        }

        followLoader.html('');
    });
}



