
let notifTopList = $('#notif-top-list');
let notifList = $('#notifications-list');
let notifLoader = $('#notification-items');
let notifTopLoader = $('#notif-top-loader');
let viewAllHtml = '                    <li class="view-all cursor" onclick="return showNotificationsView()">\n' +
    '                        <div class="view-all-notification text-center">\n' +
    '                            <p><a href="" translate="yes">View all</a></p>\n' +
    '                        </div>\n' +
    '                    </li>';

function loadTopNotifications() {

    trantor.database.getUnviewedNotifications(function (err, result) {
        if (err) {
            console.error(err);
        } else {
            notifTopList.html(viewAllHtml);
            $('#notifications-num').html(result.length);

            result.forEach(function (notif) {
                notifTopLoader.load('./elements/top-notification-item.html', function () {
                    let notifId = Utils.makeHash(notif.author + notif.type + notif.resource + notif.on_date + notif.viewed);

                    let momentDate = moment(notif.on_date * 1000, 'x').fromNow();
                    switch (notif.type) {
                        case PUBLICATION.TYPE.CONTENT:
                            trantor.database.getMediaByAddress(notif.resource, function (err, result) {
                                if (err) {
                                    console.error(err);
                                } else if (result.length > 0) {
                                    result = result[0];
                                    let avatar = resolveAvatar(result.avatarFile, result.user_address);
                                    $('#notif-date-').html(momentDate).attr('id', 'notif-date-' + notifId);
                                    $('#notif-profile-name-').html(result.name || lang.Anonymous).attr('id', 'notif-profile-name-' + notifId);
                                    $('#notif-profile-avatar-').attr('src', avatar).attr('id', 'notif-profile-avatar-' + notifId);
                                    $('#notif-icon-').attr('src', './assets/img/publications1.png').attr('id', 'notif-icon-' + notifId);
                                    $('#notif-description-').html(lang.NotifNewContent).attr('id', 'notif-description-' + notifId);
                                }
                            });
                            break;
                        case PUBLICATION.TYPE.FOLLOW:
                            trantor.database.getAuthor(notif.author, function (err, result) {
                                if (err) {
                                    console.error(err);
                                } else if (result.length > 0) {
                                    result = result[0];
                                    let avatar = resolveAvatar(result.avatarFile, result.address);
                                    $('#notif-date-').html(momentDate).attr('id', 'notif-date-' + notifId);
                                    $('#notif-profile-name-').html(result.name || lang.Anonymous).attr('id', 'notif-profile-name-' + notifId);
                                    $('#notif-profile-avatar-').attr('src', avatar).attr('id', 'notif-profile-avatar-' + notifId);
                                    $('#notif-icon-').attr('src', './assets/img/like1.png').attr('id', 'notif-icon-' + notifId);
                                    $('#notif-description-').html(lang.NotifFollowYou).attr('id', 'notif-description-' + notifId);
                                }
                            });
                            break;
                        case PUBLICATION.TYPE.LIKE:
                            trantor.database.getAuthor(notif.author, function (err, result) {
                                if (err) {
                                    console.error(err);
                                } else if (result.length > 0) {
                                    result = result[0];
                                    let avatar = resolveAvatar(result.avatarFile, result.address);
                                    $('#notif-date-').html(momentDate).attr('id', 'notif-date-' + notifId);
                                    $('#notif-profile-name-').html(result.name || lang.Anonymous).attr('id', 'notif-profile-name-' + notifId);
                                    $('#notif-profile-avatar-').attr('src', avatar).attr('id', 'notif-profile-avatar-' + notifId);
                                    $('#notif-icon-').attr('src', './assets/img/like1.png').attr('id', 'notif-icon-' + notifId);
                                    $('#notif-description-').html(lang.NotifLike).attr('id', 'notif-description-' + notifId);
                                }
                            });
                            break;
                        case PUBLICATION.TYPE.COMMENT:
                            trantor.database.getAuthor(notif.author, function (err, result) {
                                if (err) {
                                    console.error(err);
                                } else if (result.length > 0) {
                                    result = result[0];
                                    let avatar = resolveAvatar(result.avatarFile, result.address);
                                    $('#notif-date-').html(momentDate).attr('id', 'notif-date-' + notifId);
                                    $('#notif-profile-name-').html(result.name || lang.Anonymous).attr('id', 'notif-profile-name-' + notifId);
                                    $('#notif-profile-avatar-').attr('src', avatar).attr('id', 'notif-profile-avatar-' + notifId);
                                    $('#notif-icon-').attr('src', './assets/img/like1.png').attr('id', 'notif-icon-' + notifId);
                                    $('#notif-description-').html(lang.NotifComment).attr('id', 'notif-description-' + notifId);
                                }
                            });
                            break;
                    }

                    let notifHtml = notifTopLoader.html();
                    notifTopList.prepend(notifHtml);
                    notifTopLoader.html('');
                })
            })
        }
    }, 10);
}

function loadPageNotifications() {
    trantor.database.getNotifications(function (err, result) {
        if (err) {
            console.error(err);
        } else {
            result.forEach(function (notif) {
                notifLoader.load('./elements/top-notification-item.html', function () {
                    let notifId = Utils.makeHash(notif.author + notif.type + notif.resource + notif.on_date + notif.viewed);

                    let momentDate = moment(notif.on_date * 1000, 'x').fromNow();
                    switch (notif.type) {
                        case PUBLICATION.TYPE.CONTENT:
                            trantor.database.getMediaByAddress(notif.resource, function (err, result) {
                                if (err) {
                                    console.error(err);
                                } else if (result.length > 0) {
                                    result = result[0];
                                    let avatar = resolveAvatar(result.avatarFile, result.user_address);
                                    $('#notification-date-').html(momentDate).attr('id', 'notification-date-' + notifId);
                                    $('#notification-profile-name-').html(result.name || lang.Anonymous).attr('id', 'notification-profile-name-' + notifId);
                                    $('#notification-profile-avatar-').attr('src', avatar).attr('id', 'notification-profile-avatar-' + notifId);
                                    $('#notification-icon-').attr('src', './assets/img/publications1.png').attr('id', 'notif-icon-' + notifId);
                                    $('#notification-description-').html(lang.NotifNewContent).attr('id', 'notification-description-' + notifId);
                                }
                            });
                            break;
                        case PUBLICATION.TYPE.FOLLOW:
                            trantor.database.getAuthor(notif.author, function (err, result) {
                                if (err) {
                                    console.error(err);
                                } else if (result.length > 0) {
                                    result = result[0];
                                    let avatar = resolveAvatar(result.avatarFile, result.address);
                                    $('#notification-date-').html(momentDate).attr('id', 'notification-date-' + notifId);
                                    $('#notification-profile-name-').html(result.name || lang.Anonymous).attr('id', 'notification-profile-name-' + notifId);
                                    $('#notification-profile-avatar-').attr('src', avatar).attr('id', 'notification-profile-avatar-' + notifId);
                                    $('#notification-icon-').attr('src', './assets/img/like1.png').attr('id', 'notification-icon-' + notifId);
                                    $('#notification-description-').html(lang.NotifFollowYou).attr('id', 'notification-description-' + notifId);
                                }
                            });
                            break;
                        case PUBLICATION.TYPE.LIKE:
                            trantor.database.getAuthor(notif.author, function (err, result) {
                                if (err) {
                                    console.error(err);
                                } else if (result.length > 0) {
                                    result = result[0];
                                    let avatar = resolveAvatar(result.avatarFile, result.address);
                                    $('#notification-date-').html(momentDate).attr('id', 'notification-date-' + notifId);
                                    $('#notification-profile-name-').html(result.name || lang.Anonymous).attr('id', 'notification-profile-name-' + notifId);
                                    $('#notification-profile-avatar-').attr('src', avatar).attr('id', 'notification-profile-avatar-' + notifId);
                                    $('#notification-icon-').attr('src', './assets/img/like1.png').attr('id', 'notification-icon-' + notifId);
                                    $('#notification-description-').html(lang.NotifLike).attr('id', 'notification-description-' + notifId);
                                }
                            });
                            break;
                        case PUBLICATION.TYPE.COMMENT:
                            trantor.database.getAuthor(notif.author, function (err, result) {
                                if (err) {
                                    console.error(err);
                                } else if (result.length > 0) {
                                    result = result[0];
                                    let avatar = resolveAvatar(result.avatarFile, result.address);
                                    $('#notification-date-').html(momentDate).attr('id', 'notification-date-' + notifId);
                                    $('#notification-profile-name-').html(result.name || lang.Anonymous).attr('id', 'notification-profile-name-' + notifId);
                                    $('#notification-profile-avatar-').attr('src', avatar).attr('id', 'notification-profile-avatar-' + notifId);
                                    $('#notification-icon-').attr('src', './assets/img/like1.png').attr('id', 'notification-icon-' + notifId);
                                    $('#notification-description-').html(lang.NotifComment).attr('id', 'notification-description-' + notifId);
                                }
                            });
                            break;
                    }

                    let notifHtml = notifTopLoader.html();
                    notifList.prepend(notifHtml);
                    notifLoader.html('');
                })
            })
        }
    }, 10);
}

function loadAllNotifications() {
    loadTopNotifications();
    loadPageNotifications();
}