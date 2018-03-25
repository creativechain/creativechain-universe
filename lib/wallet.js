let qrcode = require('qrcode');
let createCsvWriter = require('csv-writer').createObjectCsvWriter;

let recentTxVueList = null;
let historyTxVueList = null;
let addressBookVueList = null;

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

            if (!addressBookVueList) {
                addressBookVueList = new Vue({
                    el: '#address-book',
                    data: {
                        entries: result,
                        lang: lang,
                        selectedEntry: null,
                    },
                    methods: {
                        prepareSend, prepareSend,
                        deleteEntry: deleteAddressBookEntry,
                        selectEntry: function (entry) {
                            addressBookVueList.$data.selectedEntry = entry;
                        }
                    }
                })
            } else {
                addressBookVueList.$data.entries = result;
            }
        }
    })
}

function putTransactions() {
    trantor.client.listTransactions('*', 9999, function (err, result) {
        //console.log(err, result);

        if (err) {
            console.error(err);
            setTimeout(function () {
                putTransactions();
            }, 1000);
        } else {
            let transactions = result;
            transactions = transactions.reverse();

            let txs = [];
            let htxs = [];

            for (let x = 0; x < transactions.length; x++) {
                let tx = transactions[x];
                tx.amount = new CreativeCoin(tx.amount * Math.pow(10, 8));
                tx.isConfirmed = tx.confirmations ? tx.confirmations > 0 : false;
                tx.icon = R.IMG.COMMON.OK;

                if (tx.abandoned) {
                    tx.icon = R.IMG.COMMON.KO;
                } else if (tx.isConfirmed) {
                    tx.icon = R.IMG.COMMON.OK;
                } else {
                    tx.icon = R.IMG.COMMON.PENDING;
                }

                switch (tx.category) {
                    case 'send':
                        tx.directionIcon = R.IMG.WALLET.SEND;
                        tx.category = lang.Sent;
                        break;
                    case 'receive':
                        tx.directionIcon = R.IMG.WALLET.RECEIVE;
                        tx.category = lang.Received;
                        break;

                }

                if (!tx.amount.isZero()) {
                    htxs.push(tx);
                    if (txs.length < 10) {
                        txs.push(tx);
                    }
                }
            }

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

            if (!historyTxVueList) {
                historyTxVueList = new Vue({
                    el: '#tx-list-details',
                    data: {
                        transactions: htxs
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
                historyTxVueList.$data.transactions = htxs;
            }

        }
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
            console.log(prices, responseVar);
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
                        trantor.events.emit('onBeforeTransactionSend', txBuilder, creaBuilder);
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

    let name = 'wallet.dat';
    let title = String.format(lang.SaveFile, name);
    dialog.showSaveDialog(null, {
        title: title,
        defaultPath: name
    }, function (fileName) {
        if (fileName) {
            trantor.client.stop();
            modal.loading();

            let timeout = 3000;
            if (OS.isMac()) {
                timeout = 10000;
            }
            setTimeout(function () {
                File.cp(Constants.WALLET_FILE, fileName);
                modal.hide();

                trantor.initClients();
                let notifBody = String.format(lang.FileCopied, fileName);
                Notifications.notify(lang.Files, notifBody, './assets/img/notification/wallet.png', 10);
            }, timeout)
        }
    })
}

function loadWalletFile() {
    dialog.showOpenDialog((fileNames) => {
        if(fileNames){
            let walletFile = fileNames[0];
            $('#wallet-file').val(walletFile);

            let destFile = Constants.WALLET_FOLDER + 'wallet.dat';

            trantor.client.stop();
            File.mkpath(destFile, true);
            File.cp(walletFile, destFile);
            trantor.start();

            modal.alert({
                message: String.format(lang.FileLoadedCorrectly, walletFile)
            })
        } else {
            console.log("No file selected");
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

function exportTxs() {
    dialog.showSaveDialog({
        title: lang.ExportTransactions
    }, function (fileName) {
        if (fileName) {
            trantor.client.listTransactions('*', 9999, function (err, result) {
                if (err) {
                    console.error(err);
                } else if (result.length > 0) {
                    modal.loading(lang.ExportingTransactions);
                    const csvWriter = createCsvWriter({
                        path: fileName,
                        header: [
                            {id: 'confirmed', title: lang.Confirmed },
                            {id: 'date', title: lang.Date },
                            {id: 'type', title: lang.Type},
                            {id: 'label', title: lang.Label},
                            {id: 'address', title: lang.Address },
                            {id: 'amount', title: lang.AmountInCrea },
                            {id: 'ID', title: lang.ID },
                        ]
                    });

                    let records = [];
                    result.forEach(function (tx) {
                        if (tx.amount > 0) {
                            let type = "";
                            switch (tx.category) {
                                case 'send':
                                    type = lang.Sent;
                                    break;
                                case 'receive':
                                    type = lang.Received;
                                    break;

                            }

                            let data = {
                                confirmed: tx.confirmations > 0,
                                date: new Date(tx.timereceived * 1000).toDateString(),
                                type: type,
                                tag: tx.label,
                                address: tx.address,
                                amount: tx.amount,
                                ID: tx.txid
                            };

                            records.push(data);
                        }

                    });

                    csvWriter.writeRecords(records)       // returns a promise
                        .then(() => {
                        modal.hide();
                            console.log('Transactions exported!');
                        });
                }
            });
        }
    })
}

function exportAddressBook() {
    dialog.showSaveDialog({
        title: lang.ExportTransactions
    }, function (fileName) {
        if (fileName) {
            trantor.database.getAddressBook(function (err, result) {
                if (err) {
                    console.error(err);
                } else if (result.length > 0) {
                    modal.loading();
                    const csvWriter = createCsvWriter({
                        path: fileName,
                        header: [
                            {id: 'label', title: lang.Label },
                            {id: 'address', title: lang.Address }
                        ]
                    });

                    let records = [];
                    result.forEach(function (entry) {
                        let data = {
                            label: entry.label,
                            address: entry.address
                        };

                        records.push(data);
                    });

                    csvWriter.writeRecords(records)       // returns a promise
                        .then(() => {
                            modal.hide();
                            console.log('AddressBook exported!');
                        });
                }
            });
        }
    })
}

function deleteAddressBookEntry(address) {
    trantor.database.removeAddress(address);
    setTimeout(function () {
        loadAddressBook()
    }, 200);
}