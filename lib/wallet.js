
let remote = require('electron').remote;
let trantor = new Trantor(Network.TESTNET);

remote.getGlobal("ticker").listener = function () {
    console.log('Setting ticker prices');
    putBalance();
};

trantor.onError = function (error) {
    console.error(error);
};

function init() {
    refreshWallet();

    //Refresh Wallet view each 10 seconds
    setInterval(function () {
        refreshWallet();
    }, 10 * 1000);
}

function refreshWallet() {
    putTransactions();
    putBalance();
}

function putTransactions() {
    trantor.client.listTransactions('*', function (err, result) {
        let transactions = result.result;
        //console.log('Transactions:', transactions);
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
            let date = new Date(tx.timereceived * 1000).toLocaleString();
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
        <p>${tx.address}</p>
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
        })

    })

}
function putBalance() {
    let balance = {};
    let count = 2;
    let onFinish = function () {
        if (count === 0) {
            let prices = remote.getGlobal('ticker');
            console.log(prices);
            balance.pending = new CreativeCoin(balance.total.amount - balance.available.amount);
            //Wallet Overview
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
        let amount = result.result * Math.pow(10, 8);
        balance.total = new CreativeCoin(amount);
        count--;
        onFinish();
    });

    trantor.client.getBalance(function (err, result) {
        let amount = result.result * Math.pow(10, 8);
        balance.available = new CreativeCoin(amount);
        count--;
        onFinish();
    });


}

function validateSendCoins() {
    let address = $('#send-address').val();
    let amount = parseFloat($('#send-amount').val());
    let subtractFee = $('#send-subtract-fee').is(':checked');

    sendCoins(address, amount, 0, subtractFee);
}

function sendCoins(address, amount, feeKb = 0, subtractFeeFromAmount = 0) {

    console.log(address, amount, feeKb, subtractFeeFromAmount);
    let performSend = function () {
      trantor.client.sendToAddress(address, amount, "", "", subtractFeeFromAmount, function (err, result) {
          if (err) {
              console.error(err);
              alert(err.message);
          } else{
              refreshWallet();
              alert('Transaction sended!\n' + result.result);
          }
      })
    };

    if (feeKb > 0) {
        trantor.client.setTxFee(new CreativeCoin(feeKb).toPlainString(8), function (err, result) {
            console.log(err, result);
            if (!err) {
                performSend();
            }
        })
    } else {
        performSend();
    }
}


trantor.start(function () {
    init();

});
