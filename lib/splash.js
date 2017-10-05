const {Network, Trantor} = require('./lib/trantor');
let intent = require('electron').remote;

let trantor = new Trantor(Network.TESTNET);
let userAddress = null;

trantor.start(function () {
    console.log('Trantor initialized!');
    setTimeout(function () {
        init();
    }, 3000);
});

function init() {
    userAddress = localStorage.getItem('userAddress');
    if (!userAddress) {
        trantor.client.getNewAddress(function (err, result) {
            console.log(err, result);
            localStorage.setItem('userAddress', result.result);
            setUserAddress();
        })
    } else {
        setUserAddress();
    }

}

function setUserAddress() {
    $('#user-address').html(userAddress);
}

function encryptWallet() {

    let password = $('#wallet-password').val();
    let repeatPassword = $('#wallet-repeat-password').val();

    if (localStorage.getItem('password')) {
        alert(lang['WalletEncrypted']);
    } else {
        console.log(password, repeatPassword);
        if (password.length > 0 && repeatPassword.length > 0 && password === repeatPassword) {
            trantor.encryptWallet(password, function (err, result) {
                if (err) {
                    alert(err.message)
                } else {
                    console.log('Wallet encrypted!', result);
                    localStorage.setItem('password', password);
                    setTimeout(function () {
                        trantor.start();
                    }, 1000)
                }
            })
        } else {
            alert(lang['Passwords do not match']);
        }
    }

}