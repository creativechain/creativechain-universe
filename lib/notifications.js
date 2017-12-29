

let notifLoader = $('#notification-items');
let notifTopLoader = $('#notification-top-loader');
let viewAllHtml = '                    <li class="view-all cursor" onclick="return showNotificationsView()">\n' +
    '                        <div class="view-all-notification text-center">\n' +
    '                            <p><a href="" translate="yes">View all</a></p>\n' +
    '                        </div>\n' +
    '                    </li>';

function loadTopNotifications() {
    let notifTopList = $('#notif-top-list');
    notifTopList.html('')
    getUserAddress(function (userAddress) {
        trantor.database.getUnviewedNotifications(function (err, nots) {
            if (err) {
                console.error(err);
            } else if (nots.length > 0) {
                $('#notifications-num').html(nots.length);
                $('#badge-notifications').removeClass('hidden');
                notifTopList.append(viewAllHtml);
                nots.forEach(function (notif) {
                    //console.log('Notif item', notif)

                    let onBuildNotif = function (notifId, name, avatar, icon, description, momentDate) {
                        let notifHtml = `
<li class="cursor" onclick="return showNotificationsView()">
    <div class="list-notifications">
        <div class="notification-profile">
            <img class="img-circle" id="notif-profile-avatar-${notifId}" src="${avatar}" alt="">
        </div>
        <div class="description-notification">
            <p id="notif-profile-name-${notifId}">${name}<span id="notif-date-${notifId}">${momentDate}</span></p>
            <p>
                <img id="notif-icon-${notifId}" src="${icon}" alt="">
                <span id="notif-description-${notifId}">${description}</span>
            </p>
        </div>
    </div>
</li>
<li role="separator" class="divider"></li>`
                        notifTopList.prepend(notifHtml);
                    };

                    switch (notif.type) {
                        case PUBLICATION.TYPE.CONTENT:
                            trantor.database.getMediaByAddress(notif.resource, userAddress, function (err, result) {
                                if (err) {
                                    console.error(err);
                                } else if (result.length > 0) {
                                    result = result[0];
                                    let notifId = Utils.makeHash(notif.author + notif.type + notif.resource + notif.on_date + notif.viewed);
                                    let momentDate = moment(notif.on_date, 'x').fromNow();
                                    let avatar = resolveAvatar(result.avatarFile, result.user_address);
                                    let name = result.name || lang.Anonymous;
                                    let icon = './assets/img/publications1.png';
                                    let description = lang.NotifNewContent;

                                    onBuildNotif(notifId, name, avatar, icon, description, momentDate);
                                }
                            });
                            break;
                        case PUBLICATION.TYPE.FOLLOW:
                            trantor.database.getAuthor(notif.author, function (err, result) {
                                if (err) {
                                    console.error(err);
                                } else if (result.length > 0) {
                                    result = result[0];
                                    let notifId = Utils.makeHash(notif.author + notif.type + notif.resource + notif.on_date + notif.viewed);
                                    let momentDate = moment(notif.on_date, 'x').fromNow();
                                    let avatar = resolveAvatar(result.avatarFile, result.address);
                                    let name = result.name || lang.Anonymous;
                                    let icon = './assets/img/like0.png';
                                    let description = lang.NotifFollowYou;
                                    onBuildNotif(notifId, name, avatar, icon, description, momentDate);
                                }
                            });
                            break;
                        case PUBLICATION.TYPE.LIKE:
                            trantor.database.getAuthor(notif.author, function (err, result) {
                                if (err) {
                                    console.error(err);
                                } else if (result.length > 0) {
                                    result = result[0];
                                    let notifId = Utils.makeHash(notif.author + notif.type + notif.resource + notif.on_date + notif.viewed);
                                    let momentDate = moment(notif.on_date, 'x').fromNow();
                                    let avatar = resolveAvatar(result.avatarFile, result.address);
                                    let name = result.name || lang.Anonymous;
                                    let icon = './assets/img/like0.png';
                                    let description = lang.NotifLike;
                                    onBuildNotif(notifId, name, avatar, icon, description, momentDate);
                                }
                            });
                            break;
                        case PUBLICATION.TYPE.COMMENT:
                            trantor.database.getAuthor(notif.author, function (err, result) {
                                if (err) {
                                    console.error(err);
                                } else if (result.length > 0) {
                                    result = result[0];
                                    let notifId = Utils.makeHash(notif.author + notif.type + notif.resource + notif.on_date + notif.viewed);
                                    let momentDate = moment(notif.on_date, 'x').fromNow();
                                    let avatar = resolveAvatar(result.avatarFile, result.address);
                                    let name = result.name || lang.Anonymous;
                                    let icon = './assets/img/comments.png';
                                    let description = lang.NotifComment;
                                    onBuildNotif(notifId, name, avatar, icon, description, momentDate);
                                }
                            });
                            break;
                    }


                });

                console.log(notifTopList.attr('id'));
            } else {
                $('#badge-notifications').removeClass('hidden');
            }
        }, 10);
    });

}

function loadPageNotifications() {
    let notifList = $('#notifications-list');
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