
trantor.events.subscribe('onStart', 'settings', function () {
    loadUser();
    loadValues();
});

function loadUser() {

    getUserAddress(function (userAddress) {
        trantor.getUserData(userAddress, function (err, results) {
            if (err) {
                console.error(err);
            } else  if (results && results.length > 0) {
                let user = results[0];
                $('#settings-user-name').html(user.name);
                $('#settings-user-description').html(user.web || user.description);

                let avatar = resolveAvatar(user.avatarFile, user.address, 80);
                $('#settings-user-avatar').attr('src', avatar);
            }
            console.log(results);
        })

    });

}

function loadValues() {
    console.log(settings);
    let exCoin = settings.getKey('exchange-coin', 'usd');
    let language = settings.getKey('language', lang.locale);
    let actionAmount = parseFloat(settings.getKey('action-amount', 0.0001));
    let sessionTime = settings.getKey('session-time', 0);

    $('#settings-exchange-coin').val(exCoin);
    $('#settings-language').val(language);
    $('#settings-action-amount').val(actionAmount);
    $('#settings-expire-time').val(sessionTime);
}

function save() {

    let exCoin = $('#settings-exchange-coin').val();
    let language = $('#settings-language').val();
    let actionAmount = $('#settings-action-amount').val();
    let sessionTime = $('#settings-expire-time').val();

    let settings = FileStorage.load();
    settings.setKey('exchange-coin', exCoin);
    settings.setKey('language', language);
    settings.setKey('action-amount', actionAmount);
    settings.setKey('session-time', sessionTime);

    console.log(settings);
}