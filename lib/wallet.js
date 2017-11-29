let qrcode = require('qrcode');

control.getGlobal("ticker").listener = function () {
    console.log('Setting ticker prices');
    putBalance();
};

trantor.events.subscribe('onStart', 'wallet', function () {
    initWallet();
});

function initWallet() {
    refreshWallet();

    //Refresh Wallet view each 10 seconds
    setInterval(function () {
        refreshWallet();
    }, 10 * 1000);

    putRequestPayments();
}

function refreshWallet() {
    putTransactions();
    putBalance();
}

function putTransactions() {
    trantor.client.listTransactions('*', function (err, result) {
        //console.log(err, result);

        if (err) {
            console.error(err);
            setTimeout(function () {
                putTransactions();
            }, 1000);
        } else {
            let transactions = result;
            let txList = $('#tx-list');
            let txListDetails = $('#tx-list-details');
            txList.html('');
            txListDetails.html('');
            transactions = transactions.reverse();
            transactions.forEach(function (tx, index, txs) {

                let amount = new CreativeCoin(tx.amount * Math.pow(10, 8));
                let isConfirmed = tx.confirmations ? tx.confirmations > 0 : false;
                let stateIcon = "";
                let directionIcon = "";
                let date = new Date(tx.timereceived * 1000).toLocaleString(lang.locale);
                switch (tx.category) {
                    case 'send':
                        stateIcon = "assets/img/table/ko.png";
                        directionIcon = "assets/img/wallet/icon-send.png";
                        break;
                    case 'receive':
                        stateIcon = "assets/img/table/ok.png";
                        directionIcon = "assets/img/wallet/icon-receive.png";
                        break;

                }

                if (!isConfirmed) {
                    stateIcon = "assets/img/table/process.png";
                }

                txList.append(`<tr>
    <th><img src="${stateIcon}" alt=""></th>
    <td class="tableDetails">
        <p>${date}</p>
        <p>${tx.txid}</p>
    </td>
    <td class="tableDetailsAmount"><p>${amount.toString()}</p></td>
</tr>`);

                txListDetails.append(`<tr>
                                            <th><img src="${stateIcon}" alt=""></th>
                                            <td><p>${date}</p></td>
                                            <td><p>${tx.category}</p></td>
                                            <td><p><img src="${directionIcon}" alt="">${tx.address}</p></td>
                                            <td><p>${amount.toString()}</p></td>
                                        </tr>`);
            });
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
                    let message = request.message && request.message.length > 0 ? request.message : lang['(Without message)'];
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
            let prices = control.getGlobal('ticker');
            balance.pending = new CreativeCoin(balance.total.amount - balance.available.amount);
            //console.log(prices);
            //Wallet Overview
            $('#top-balance').html(balance.total.toString());
            $('#total-balance').html(balance.total.toString());
            $('#amount-navbar').html(balance.total.toString());
            $('#total-balance-detail').html(balance.total.toString());
            $('#total-balance-fiat').html(Prices.convert(balance.total, prices.price_usd).toString());
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
        //console.log('Total balance', result);
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
    let address = $('#send-address').val();
    let label = $('#address-label').val();
    let amount = parseFloat($('#send-amount').val());
    let subtractFee = $('#send-subtract-fee').is(':checked');

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
    let performSend = function () {
        trantor.client.sendToAddress(address, amount, "", "", subtractFeeFromAmount, function (err, result) {
            if (err) {
                console.error(err);
                modal.error({
                    message: err.message
                });

            } else{
                refreshWallet();
                //console.log(result);
                modal.alert({
                    message: lang.TransactionSend + '\n' + result
                });

                clearSendFields();
            }
        })
    };

    if (feeKb > 0) {
        trantor.client.setTxFee(new CreativeCoin(feeKb).toPlainString(8), function (err, result) {
            //console.log(err, result);
            if (!err) {
                performSend();
            }
        })
    } else {
        performSend();
    }
}

function clearSendFields() {
    $('#send-address').val('');
    $('#address-label').val('');
    $('#send-amount').val('');
    $('#send-subtract-fee').prop('checked', false);
}

function requestPayment() {
    let label = $('#request-payment-label').val();
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
}

function showPayment(address) {
    trantor.database.getPaymentRequest(address, function (err, payment) {
        payment = payment[0];

        let coinUri = new CoinUri(payment.address, payment.amount, payment.label, payment.message);
        modal.qr({
            title: coinUri.address,
            text: coinUri.toString(),
            scale: 8
        })

    })
}