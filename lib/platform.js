
const {Network, Trantor, CreativeCoin, Notifications} = require('./lib/trantor');
const {dialog} = require('electron').remote;

let itemList = $('#content-list');
let itemLoader = $('#publication-items');

let trantor = new Trantor(Network.TESTNET);

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

    trantor.database.getAllMedia(function (err, result) {
        console.log(result);

        result.forEach(function (row) {
            loadItem(row);
        })
    });

    let lastExploredBlock = localStorage.getItem('lastExploredBlock');
    if (!lastExploredBlock) {
        lastExploredBlock = 1;
    }

    trantor.explore(lastExploredBlock);
/*    trantor.register('ander7agar', 'ander7agar@gmail.com', 'http://owldevelopers.tk', 'Creativechain CTO', '/home/ander/avatar.jpg', function () {

    })*/
}

function loadItem(data) {
    itemLoader.load('./elements/content-item.html', function () {
        $('#content-item-title-').html(data.title).attr('id', 'content-item-title-' + data.address);
        $('#content-item-description-').html(data.description).attr('id', 'content-item-description-' + data.address);
        $('#content-item-like-count-').html(data.likes).attr('id', 'content-item-like-count-' + data.address);
        $('#content-item-comments-').html(data.comments).attr('id', 'content-item-comments-' + data.address);

        let item = itemLoader.html();
        itemList.append(item);
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