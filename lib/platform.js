


let trantor = new Trantor(Network.TESTNET);

trantor.onError = function (error) {
    console.error(error);
};

trantor.start();
