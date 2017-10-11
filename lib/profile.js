const {Network, Trantor, CreativeCoin, Notifications} = require('./lib/trantor');
const {dialog} = require('electron').remote;

let itemList = $('#content-list');
let itemLoader = $('#publication-items');

let trantor = new Trantor(Network.TESTNET);

trantor.start(function () {
    console.log('Trantor initialized!');

    setTimeout(function () {
        putBalance();
        putUserData();
    }, 500);
});

function putUserData() {

    let address = localStorage.getItem('userAddress');
    trantor.getUserData(address, function (result) {
        console.log(result);
        if (result && result.length > 0) {
            let user = result[0];
            $('#user-nick').html(user.name);
            $('#user-web').html(user.web);
            $('#user-description').html(user.description);
            $('#user-buzz').html();

            $('#user-likes').html(user.likes);
            $('#user-comments').html(user.comments);
            $('#user-actions').html();
            $('#user-followers').html(user.followers);
        }

    });

    $('#user-address').html(address);

}

function putBalance() {
    let balance = {};
    trantor.client.getBalance('*', 0, function (err, result) {
        let amount = result.result * Math.pow(10, 8);
        balance.total = new CreativeCoin(amount);
        $('#top-balance').html(balance.total.toString());
        $('#top-balance-tooltip').attr('title', balance.total.toString());
    });

    setTimeout(function () {
        putBalance();
    }, 20 * 1000);

}