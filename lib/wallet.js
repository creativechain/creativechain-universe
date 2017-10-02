
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
    putTransactions();
    putBalance();
}

function putTransactions() {
    trantor.client.listTransactions('*', function (err, result) {
        let transactions = result.result;
        console.log('Transactions:', transactions);
        let txList = $('#tx-list');
        let txListDetails = $('#tx-list-details');
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
            $('#total-balance').html(balance.total.toString());
            $('#total-balance-detail').html(balance.total.toString());
            $('#total-balance-fiat').html(Prices.convert(balance.total, prices.price_usd).toString());
            $('#pending-balance').html(balance.pending.toString());
            $('#available-balance').html(balance.available.toString());
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

function sendCoins(address, amount, feeKb = 0, subtractFeeFromAmount = 0) {

    let performSend = function () {
      trantor.client.sendToAddress(address, new CreativeCoin(amount).toPlainString(8), "", "", subtractFeeFromAmount)
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
