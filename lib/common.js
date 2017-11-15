
trantor.start(function () {
    console.log('Trantor started!');

    trantor.explore();
    setInterval(function () {
        trantor.explore();
    }, 10 * 1000);
});

function getUserAddress(callback) {
    let address = localStorage.getItem('userAddress');
    if (address) {
        if (callback) {
            callback(address);
        }
    } else {
        trantor.client.getAccountAddress('user', function (err, result) {
            if (err) {
                console.error(err);
            } else {
                address = result.result;
                localStorage.setItem('userAddress', address);
                if (callback) {
                    callback(address);
                }
            }
        })
    }
}