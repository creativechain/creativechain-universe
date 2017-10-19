
const {Network, Trantor, CreativeCoin, Notifications, Utils} = require('./lib/trantor');
const {dialog} = require('electron').remote;

let itemList = $('#content-list');
let itemLoader = $('#publication-items');

let trantor = new Trantor(Network.TESTNET);
let onSearch = false;

trantor.onError = function (error) {
    console.error(error);
};

trantor.onTorrentDownloaded = function (txid, torrent) {
    console.log('Torrent downloaded!', torrent);
    trantor[txid](torrent);
};

trantor.onDataFound = function (transaction, data, blockTime) {
    console.log('Data found', data);
    let type = data.type;

    switch (type) {
        case PUBLICATION.TYPE.CONTENT:
            trantor.database.addMedia(data, tx, blockTime);
            localStorage.setItem(tx.hash, data.publicContent);
            trantor.downloadTorrent(tx.hash, data.publicContent);
            break;
        case PUBLICATION.TYPE.USER:
            trantor.database.addAuthor(data, tx, blockTime);
            break;
        case PUBLICATION.TYPE.LIKE:
            trantor.database.addLike(data, tx);
            break;
        case PUBLICATION.TYPE.COMMENT:
            trantor.database.addComment(data, tx);
            break;
        case PUBLICATION.TYPE.DONATION:
            trantor.database.addDonation(data, tx);
            break;
        case PUBLICATION.TYPE.FOLLOW:
        case PUBLICATION.TYPE.UNFOLLOW:
            trantor.database.addFollowing(data, tx);
            break;
        default:
            //Type unknown or untreated
    }
};

trantor.onExploreStart = function (startBlock) {
    console.log('Trantor exploration started until block ' + startBlock);
};

trantor.onExploreProgress = function (total, current) {
    console.log(total, current, (current * 100 / total) + '%')
};

trantor.onExploreFinish = function (blockCount) {
    console.log('Trantor exploration process finished');
    setTimeout(function () {
        trantor.explore(blockCount);
    }, 60 * 1000);
};

/**
 *
 * @param {TransactionBuilder} txBuilder
 * @param {Array} spendables
 */
trantor.onBeforeTransactionSend = function (txBuilder, spendables) {
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
};

/**
 *
 * @param {DecodedTransaction} tx
 */
trantor.onAfterTransactionSend = function (tx) {
    Notifications.notify(lang['TransactionSend'], tx.hash, './assets/img/wallet-alert.png', 2);
};

trantor.start(function () {
    console.log('Trantor initialized!');

    setTimeout(function () {
        putBalance();
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

    let lastExploredBlock = localStorage.getItem('lastExploredBlock');
    if (!lastExploredBlock) {
        lastExploredBlock = 1;
    }

    trantor.explore(lastExploredBlock);

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

function putBalance() {
    let balance = {};
    trantor.client.getBalance('*', 0, function (err, result) {
        let amount = result.result * Math.pow(10, 8);
        balance.total = new CreativeCoin(amount);
        $('#top-balance').html(balance.total.toString());
        $('#top-balance-tooltip').attr('title', balance.total.toString());
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

function onSearchText(e) {
    if (e.keyCode === 13 || e.keyCode === 10) { //Enter Key
        search();
    } else {
        let val = $('#content-search').val();
        if (!val || val.length === 0) {
            onSearch = false;
            loadAllMedia();
        }
    }

    return true;
}

function search(words) {
    onSearch = true;
    if (!words) {
        words = $('#content-search').val();
        words.replace(' ', '+');
    }

    words = words.split('+');

    trantor.search(words, function (result) {
        loadItems(result);
    });

}