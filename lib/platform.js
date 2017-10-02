
let remote = require('electron').remote;

let lang = remote.getGlobal('lang');

console.log(lang);
let trantor = new Trantor(Network.TESTNET);

trantor.onError = function (error) {
    console.error(error);
};

trantor.start();

function init() {

}