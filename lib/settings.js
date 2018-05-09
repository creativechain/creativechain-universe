
trantor.on('core.started', function () {
    loadUser();
    loadValues();
});

function loadUser() {

    getUserAddress(function (userAddress) {
        trantor.getUserData(userAddress, userAddress, function (err, results) {
            let avatar = resolveAvatar(null, userAddress);
            let name = lang.Anonymous;
            if (err) {
                console.error(err);
            } else  if (results && results.length > 0) {
                let user = results[0];
                name = user.name || userAddress;
                $('#settings-user-description').html(user.web || user.description);

                avatar = resolveAvatar(user.avatarFile, user.address);
            }
            //console.log(results);
            $('#settings-user-name').html(name);
            $('#settings-user-avatar')
                .css('background', 'url("' + avatar + '") center center / cover');
        })

    });

}

function loadValues() {
    console.log(settings);
    let exCoin = settings.getKey('exchange-coin', 'usd');
    let language = settings.getKey('language', lang.locale);
    let hideReports = settings.getKey('hide-reports', 5);
    let contentAmount = Coin.parseCash(TX_CONTENT_AMOUNT, 'CREA').toPlainString();
    let actionAmount = parseFloat(settings.getKey('action-amount', contentAmount));
    actionAmount = Math.max(actionAmount, parseFloat(contentAmount));

    let sessionTime = settings.getKey('session-time', 0);

    $('#settings-exchange-coin').val(exCoin);
    $('#settings-language').val(language);
    $('#settings-action-amount').val(actionAmount)
        .attr('min', contentAmount);
    $('#settings-expire-time').val(sessionTime);
    $('#settings-hide-reports').val(hideReports);
}

function validateChangePassword() {
    let oldPassword, newPassword;

    oldPassword = $('#settings-old-password').val();
    newPassword = $('#settings-new-password').val();

    if ((oldPassword && newPassword) && oldPassword.length > 0 && newPassword.length > 0) {
        changePassword(oldPassword, newPassword);
    }
}

function changePassword(oldPassword, newPassword) {
    trantor.rpcWallet.walletPassphraseChange(oldPassword, newPassword, function (err, result) {
        if (err) {
            console.error(err);
            modal.error({
                message: err.message
            })
        } else {
            walletPassword = newPassword;
            modal.loading(lang.ChangingPassword);
            trantor.restart(function () {
                //modal.hide();
            });
        }
    })
}

function save() {

    validateChangePassword();

    let exCoin = $('#settings-exchange-coin').val();
    let language = $('#settings-language').val();
    let actionAmount = $('#settings-action-amount').val();
    let sessionTime = $('#settings-expire-time').val();
    let hideReports = $('#settings-hide-reports').val();

    //let settings = FileStorage.load(CONSTANTS.APP_CONF_FILE);
    settings.setKey('exchange-coin', exCoin);
    settings.setKey('language', language);
    settings.setKey('action-amount', actionAmount);
    settings.setKey('session-time', sessionTime);
    settings.setKey('hide-reports', hideReports);

    console.log(settings);

    modal.alert({
        title: lang.Settings,
        message: lang.AppliedChangedSettings
    });

    trantor.emit('core.notification', lang.Settings, lang.AppliedChangedSettings, './assets/img/settings.png', 10);
}