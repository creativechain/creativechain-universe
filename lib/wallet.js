let qrcode = require('qrcode');

let recentTxVueList = null;

trantor.events.on('onStart', function () {
    initWallet();
});

function initWallet() {
    refreshWallet();

    //Refresh Wallet view each 10 seconds
    setInterval(function () {
        refreshWallet();
    }, 10 * 1000);

    putRequestPayments();
    loadAddressBook();
}

function refreshWallet() {
    putTransactions();
    putBalance();
}

function loadAddressBook() {
    trantor.database.getAddressBook(function (err, result) {
        if (err) {
            console.error(err);
        } else if (result.length > 0) {
            let addressBookList = $('#address-book-list');
            addressBookList.html('');
            result.forEach(function (item) {
                let address = item.address;
                let label = item.label || lang.WithoutLabel;
                let addressHtml = `<tr onclick="prepareSend('${address}', '${label}')" class="cursor">
    <td><p>${label}</p></td>
    <td><p>${address}</p></td>
</tr>`;
                addressBookList.append(addressHtml);
            })
        }
    })
}

function putTransactions() {
    trantor.client.listTransactions('*', 999, function (err, result) {
        //console.log(err, result);

        if (err) {
            console.error(err);
            setTimeout(function () {
                putTransactions();
            }, 1000);
        } else {
            let transactions = result;
            let txListDetails = $('#tx-list-details');
            txListDetails.html('');
            transactions = transactions.reverse();

            let txs = [];

            for (let x = 0; x < transactions.length; x++) {
                let tx = transactions[x];
                tx.amount = new CreativeCoin(tx.amount * Math.pow(10, 8));
                tx.isConfirmed = tx.confirmations ? tx.confirmations > 0 : false;
                tx.icon = "assets/img/table/ok.png";

                if (tx.abandoned) {
                    tx.icon = "assets/img/table/ko.png";
                } else if (tx.isConfirmed) {
                    tx.icon = "assets/img/table/ok.png";
                } else {
                    tx.icon = "assets/img/table/process.png";
                }

                if (!tx.amount.isZero()) {
                    txs.push(tx);
                }

                if (txs.length === 10) {
                    break;
                }
            }
            transactions.forEach(function (tx) {


/*                let directionIcon = "";
                let date = new Date(tx.timereceived * 1000).toLocaleString(lang.locale);
                switch (tx.category) {
                    case 'send':
                        directionIcon = "assets/img/wallet/icon-send.png";
                        break;
                    case 'receive':
                        directionIcon = "assets/img/wallet/icon-receive.png";
                        break;

                }*/

/*                txListDetails.append(`<tr>
                                            <th><img src="${stateIcon}" alt=""></th>
                                            <td><p>${date}</p></td>
                                            <td><p>${tx.category}</p></td>
                                            <td><p><img src="${directionIcon}" alt="">${tx.address}</p></td>
                                            <td><p>${amount.toString()}</p></td>
                                        </tr>`);*/
            });

            if (!recentTxVueList) {
                recentTxVueList = new Vue({
                    el: '#tx-list',
                    data: {
                        transactions: txs
                    },
                    methods: {
                        resolveDate(date, format = null) {
                            if (format) {
                                return moment(date, 'x').format(format);
                            }
                            return moment(date, 'x').fromNow();
                        }
                    }
                });
            } else {
                recentTxVueList.$data.transactions = txs;

            }
        };
    });
}

function putRequestPayments() {
    let paymentList = $('#request-payment-list');
    paymentList.html('');
    setTimeout(function () {
        trantor.database.getAllPaymentRequest(function (err, res) {
            if (err) {
                console.error(err)
            } else {
                //console.log(res);
                res.forEach(function (request) {
                    let date = new Date(request.creation_date).toLocaleString(lang.locale);
                    let message = request.message && request.message.length > 0 ? request.message : lang['WithoutMessage'];
                    let amount = Coin.parseCash(request.amount, 'CREA');
                    paymentList.append(`<tr onclick="showPayment('${request.address}')">
    <td><p>${date}</p></td>
    <td><p>${request.address}</p></td>
    <td><p>${request.label}</p></td>
    <td><p>${message}</p></td>
    <td><p>${amount.toString()}</p></td>
</tr>`
                    )
                })
            }
        })
    }, 100);

}
function putBalance() {
    let balance = {};
    let count = 2;
    let onFinish = function () {
        count--;
        if (count === 0) {
            let settings = FileStorage.load();
            let fiat = (settings.getKey('exchange-coin') || 'usd').toUpperCase();
            let responseVar = 'price_' + fiat.toLowerCase();
            let prices = control.getGlobal('ticker');
            balance.pending = new CreativeCoin(balance.total.amount - balance.available.amount);
            //console.log(prices, responseVar);
            //Wallet Overview
            $('#top-balance').html(balance.total.toString());
            $('#total-balance').html(balance.total.toString());
            $('#amount-navbar').html(balance.total.toString());
            $('#total-balance-detail').html(balance.total.toString());
            $('#total-balance-fiat').html(Prices.convert(balance.total, prices[responseVar]).toString());
            $('#pending-balance').html(balance.pending.toString());
            $('#available-balance').html(balance.available.toString());

            //Wallet Send
            let availableAmount = balance.available.toString().split('.');
            let units = availableAmount[0] + ",";
            let cents = availableAmount[1];
            $('#available-amount-unit').html(units);
            $('#available-amount-cents').html(cents);
        }
    };
    trantor.client.getBalance('*', 0, function (err, result) {
        //console.log('TotalBalance', result);
        let amount = result * Math.pow(10, 8);
        balance.total = new CreativeCoin(amount);
        onFinish();
    });

    trantor.client.getBalance(function (err, result) {
        //console.log('Available balance', result);
        let amount = result * Math.pow(10, 8);
        balance.available = new CreativeCoin(amount);
        onFinish();
    });


}

function validateSendCoins() {
    let address = removeHtml($('#send-address').val());
    let label = removeHtml($('#address-label').val());
    let amount = $('#send-amount').val();
    let subtractFee = $('#send-subtract-fee').is(':checked');

    amount = amount.replace(',', '.');
    amount = parseFloat(amount);
    amount += 0.000000001;
    amount = Coin.parseCash(amount, 'CREA').amount;
    sendCoins(address, amount, 0, subtractFee);
    updateContact(address, label);
}

function updateContact(address, label) {
    setTimeout(function () {
        trantor.database.updateAddressBook(address, label, function (err, result) {
            console.log('Updating contact', err, result);
        })
    }, 100);
}

function sendCoins(address, amount, feeKb = 0, subtractFeeFromAmount = 0) {

    console.log(address, amount, feeKb, subtractFeeFromAmount);
    trantor.getSpendables(0, function (err, spendables) {
        if (err) {
            console.error(err);
        } else if (spendables.length > 0) {
            let txBuilder = new TransactionBuilder();
            trantor.client.getRawChangeAddress(function(err, result) {
                if (err) {
                    console.error(err);
                } else {
                    txBuilder.changeAddress = result;
                    txBuilder.addOutput(address, amount);
                    txBuilder.completeTx(spendables);

                    if (txBuilder.complete) {
                        let creaBuilder = txBuilder.txb;

                        creaBuilder.txFee = txBuilder.txFee;
                        trantor.events.notify('onBeforeTransactionSend', 10, txBuilder, creaBuilder);
                    } else {
                        modal.error({
                            message: lang.TransactionNotCreated
                        })
                    }
                }

            });
        }
    });

}

function clearSendFields() {
    $('#send-address').val('');
    $('#address-label').val('');
    $('#send-amount').val('');
    $('#send-subtract-fee').prop('checked', false);

    return false;
}

function requestPayment() {
    let label = removeHtml($('#request-payment-label').val());
    let amount = parseFloat($('#request-payment-amount').val());
    let message = $('#request-payment-message').val();

    trantor.client.getNewAddress(function (err, result) {
        //console.log(result);
        let address = result;
        let date = new Date().getTime();
        trantor.database.insertPaymentRequest(address, amount, date, label, message, function (err, res) {
            putRequestPayments();
            clearPaymentFields();
        })
    });
}

function clearPaymentFields() {
    $('#request-payment-label').val('');
    $('#request-payment-amount').val('');
    $('#request-payment-message').val('');
    return false;
}

function showPayment(address) {
    trantor.database.getPaymentRequest(address, function (err, payment) {
        payment = payment[0];

        let coinUri = new CoinUri(payment.address, payment.amount, payment.label, payment.message);
        modal.qr({
            title: lang.CreativecoinAddress,
            message: coinUri.address,
            text: coinUri.toString(),
            scale: 8
        })

    })
}

function setClipboardTextAsAddress() {
    let clipAddress = getClipboardText();
    $('#send-address').val(clipAddress);

    return false;
}

function showWalletBackupModal() {
    modal.alert({
        title: lang.MakeWalletBackupTitle,
        message: lang.MakeWalletBackupDescription,
        ok: {
            text: lang.CreateBackup,
            onclick: function () {
                makeWalletBackup()
            }
        },
        cancel: {
            onclick: function () {
                
            }
        }
    });

    return false;
}

function makeWalletBackup() {
    let dialog = control.dialog;

    let isTestnet = Constants.DEBUG;
    let walletPath = Constants.BIN_FOLDER + (isTestnet ? 'testnet3' + Constants.FILE_SEPARATOR : '') + 'wallet.dat';
    let name = File.getName(walletPath);
    let title = String.format(lang.SaveFile, name);
    dialog.showSaveDialog(null, {
        title: title,
        defaultPath: name
    }, function (fileName) {
        if (fileName) {
            Notifications.notify(lang.Files, lang.CopyingFile, './assets/img/notification/wallet.png', 5);
            setTimeout(function () {
                File.cp(walletPath, fileName);
                let notifBody = String.format(lang.FileCopied, fileName);
                Notifications.notify(lang.Files, notifBody, './assets/img/notification/wallet.png', 10);
            }, 10)
        }
    })
}

function prepareSend(address, label) {
    $('#send-address').val(address);
    if (label === lang.WithoutLabel) {
        label = null;
    }
    $('#address-label').val(label || '');
    showWalletView('#ui-wallet-filter-overview', 'send');
}