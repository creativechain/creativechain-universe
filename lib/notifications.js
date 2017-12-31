

let notifLoader = $('#notification-items');
let notifTopLoader = $('#notification-top-loader');
let viewAllHtml = `
<li class="view-all cursor" onclick="return showNotificationsView()">
    <div class="view-all-notification text-center">
        <p><a href="" translate="yes">${lang.ViewAll}</a></p>
    </div>
</li>
`;

function loadTopNotifications() {
    let notifTopList = $('#notif-top-list');
    notifTopList.html('')
    getUserAddress(function (userAddress) {
        trantor.database.getUnviewedNotifications(function (err, nots) {
            notifTopList.append(viewAllHtml);
            if (err) {
                console.error(err);
            } else if (nots.length > 0) {
                $('#notifications-num').html(nots.length);

                $('#badge-notifications').removeClass('hidden');

                nots.forEach(function (notif, index) {
                    //console.log('Notif item', notif)

                    if (index < 10) {
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
                    }
                });

            } else {
                $('#badge-notifications').addClass('hidden');
            }
        }, 50);
    });

}

function loadPageNotifications() {
    let notifList = $('#notifications-list');
    notifList.html('');
    getUserAddress(function (userAddress) {
        trantor.database.getNotifications(function (err, result) {
            if (err) {
                console.error(err);
            } else {
                result.forEach(function (notif) {
                    let onBuildNotif = function (notifId, authorAddress, name, avatar, icon, description, momentDate, type, isFollowing) {
                        let notifHtml = `
<div class="row border-notifications">
    <div class="col-md-2 col-sm-2 cursor">
        <img id="notification-avatar-${notifId}" onclick="onLoadUser('${authorAddress}')" src="${avatar}" alt="" class="img-responsive img-circle img-list-followers">
    </div>
    <div class="col-md-7 col-sm-5 autor-notifications">
        <p id="notification-name-${notifId}" onclick="onLoadUser('${authorAddress}')"class="name cursor">${name} <span class="dateNotifications">${momentDate}</span> </p>
        <p id="notification-description-${notifId}" class="change-text" translate="yes">${description}</p>
    </div>
    <div class="col-md-3 col-sm-5 hidden">
        <button id="notification-button-${notifId}" class="btn btn-therciary btn-following"
        onmouseenter="followButtonEnter('notification-button-${notifId}', '${authorAddress}', ${isFollowing})" 
        onmouseLeave="followButtonLeave('notification-button-${notifId}', '${authorAddress}', ${isFollowing})" 
         style="width: 100%;" translate="yes">
            Follow
        </button>
    </div>
</div>`
                        notifList.prepend(notifHtml);
                        if (type === PUBLICATION.TYPE.FOLLOW) {
                            console.log(type, name, description, isFollowing);
                            $('#notification-button-' + notifId).parent().removeClass('hidden');
                            makeFollowButton('notification-button-' + notifId, isFollowing);

                        }
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

                                    onBuildNotif(notifId, notif.author, name, avatar, icon, description, momentDate, notif.type, false);
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

                                    trantor.database.getFollowingData(userAddress, notif.author, notif.type, function (err, follows) {
                                        let following = false;
                                        if (err) {
                                            console.error(err)
                                        } else if (follows.length > 0) {
                                            following = true;
                                        }

                                        onBuildNotif(notifId, notif.author, name, avatar, icon, description, momentDate, notif.type, following);
                                    })

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
                                    onBuildNotif(notifId, notif.author, name, avatar, icon, description, momentDate, notif.type, false);
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
                                    onBuildNotif(notifId, notif.author, name, avatar, icon, description, momentDate, notif.type, false);
                                }
                            });
                            break;
                    }
                })
            }
        }, 10);
    })

}

function loadAllNotifications() {
    loadTopNotifications();
    loadPageNotifications();
}