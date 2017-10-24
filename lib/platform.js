let itemList = $('#content-list');
let itemLoader = $('#publication-items');


let onSearch = false;

trantor.events.onExploreProgress = function (total, current) {
    console.log(total, current, (current * 100 / total) + '%')
};

trantor.events.subscribe('onExploreFinish', 'main', function (blockCount) {
    console.log('Trantor exploration process finished');
    setTimeout(function () {
        trantor.explore(blockCount);
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
                loadItem(result, true)
            }
        })
    }
}

/**
 *
 * @param {Array} items
 */
function loadItems(items) {
    itemList.html('');
    if (items) {
        items.forEach(function (item) {
            loadItem(item);
        })
    }
}

function loadItem(data, prepend = false) {
    itemLoader.load('./elements/content-item.html', function () {
        $('#content-item-title-').html(data.title).attr('id', 'content-item-title-' + data.address);
        $('#content-item-description-').html(data.description).attr('id', 'content-item-description-' + data.address);
        $('#content-item-like-count-').html(data.likes).attr('id', 'content-item-like-count-' + data.address);
        $('#content-item-comments-').html(data.comments).attr('id', 'content-item-comments-' + data.address);

        let item = itemLoader.html();
        if (prepend) {
            itemList.prepend(item);
        } else {
            itemList.append(item);
        }

        itemLoader.html('');
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
                loadItem(row);
            })
        });
    }
}



