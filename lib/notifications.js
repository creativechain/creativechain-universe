

let notifLoader = $('#notification-items');
let notifTopLoader = $('#notification-top-loader');
let viewAllHtml = `
<li class="view-all cursor" onclick="return showUserNotifications()">
    <div class="view-all-notification text-center">
        <p><a href="" translate="yes">${lang.ViewAll}</a></p>
    </div>
</li>
`;

let loadingNotif = false;
let loadingTopNotif = false;

trantor.events.subscribe('onStart', 'notifications', function () {
    loadAllNotifications();
});

function showUserNotifications() {
    loadUserData();
    return showNotificationsView();
}
function loadTopNotifications() {
    if (!loadingTopNotif) {
        loadingTopNotif = true;

        let notifTopList = $('#notif-top-list');
        notifTopList.html('')
        getUserAddress(function (userAddress) {
            trantor.database.getUnviewedNotifications(function (err, nots) {
                if (err) {
                    console.error(err);
                    loadingTopNotif = false;
                } else if (nots.length > 0) {
                    let total = nots.length > 10 ? 10 : nots.length;

                    let onLoaded = function () {
                        total--;
                        if (total <= 0) {
                            loadingTopNotif = false;
                        }
                    };

                    $('#notifications-num').html(nots.length);

                    $('#badge-notifications').removeClass('hidden');

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
                        notifTopList.append(notifHtml);
                    };

                    let notIndex = 0;

                    let processNotif = function (notif) {

                        let nextNotif = function () {
                            notIndex++;
                            if (notIndex < nots.length && notIndex <= 9) {
                                processNotif(nots[notIndex]);
                            } else {
                                notifTopList.append(viewAllHtml);
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

                                        onBuildNotif(notifId, name, avatar, icon, description, momentDate);
                                    }
                                    onLoaded();
                                    nextNotif();
                                });
                                break;
                            case PUBLICATION.TYPE.FOLLOW:
                                trantor.database.getAuthor(notif.author, userAddress, function (err, result) {
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
                                    onLoaded();
                                    nextNotif();
                                });
                                break;
                            case PUBLICATION.TYPE.LIKE:
                                trantor.database.getAuthor(notif.author, userAddress, function (err, result) {
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
                                    onLoaded();
                                    nextNotif();
                                });
                                break;
                            case PUBLICATION.TYPE.COMMENT:
                                trantor.database.getAuthor(notif.author, userAddress, function (err, result) {
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
                                    onLoaded();
                                    nextNotif();
                                });
                                break;
                            case PUBLICATION.TYPE.PAYMENT:
                                trantor.database.getAuthor(notif.author, userAddress, function (err, result) {
                                    if (err) {
                                        console.error(err);
                                    } else if (result.length > 0) {
                                        result = result[0];
                                        let notifId = Utils.makeHash(notif.author + notif.type + notif.resource + notif.on_date + notif.viewed);
                                        let momentDate = moment(notif.on_date, 'x').fromNow();
                                        let avatar = resolveAvatar(result.avatarFile, result.address);
                                        let name = result.name || lang.Anonymous;
                                        let icon = './assets/img/notification/wallet.png';
                                        let description = lang.NotifPayment;
                                        onBuildNotif(notifId, name, avatar, icon, description, momentDate);
                                    }
                                    onLoaded();
                                    nextNotif();
                                });
                                break;
                        }
                    };

                    processNotif(nots[notIndex]);

                } else {
                    loadingTopNotif = false;
                    $('#badge-notifications').addClass('hidden');
                }
            }, 99999);
        });
    }


}

function loadPageNotifications() {
    if (!loadingNotif) {
        loadingNotif = true;
        let notifList = $('#notifications-list');
        notifList.html('');
        getUserAddress(function (userAddress) {
            trantor.database.getNotifications(function (err, nots) {
                if (err) {
                    console.error(err);
                    loadingNotif = true;
                } else if (nots.length > 0) {
                    let total = nots.length > 10 ? 10 : nots.length;

                    let onLoaded = function () {
                        total--;
                        if (total <= 0) {
                            loadingTopNotif = false;
                        }
                    };

                    let onBuildNotif = function (notifId, authorAddress, name, avatar, icon, description, momentDate, type, isFollowing, contentAddress) {
                        let notifHtml = `
<div id="notification-${notifId}" class="row border-notifications row-list-notification">
    <div class="row-list-notification-avatare cursor">
        <div id="notification-avatar-${notifId}" class="img-circle-following img-center" 
        style="background: url('${avatar}') center center; background-size: cover"
        onclick="onLoadUser('${authorAddress}')"></div>
    </div>
    <div class="row-list-notification-autor autor-notifications change-text">
        <p id="notification-name-${notifId}" onclick="onLoadUser('${authorAddress}')"class="name cursor change-text">${name} <span class="dateNotifications">${momentDate}</span> </p>
        <p id="notification-description-${notifId}" class="change-text" translate="yes">${description}</p>
    </div>
    <div class="row-list-notification-options hidden">
        <button id="notification-button-${notifId}" class="btn btn-therciary btn-following"
                onmouseenter="followButtonEnter('notification-button-${notifId}', '${authorAddress}', ${isFollowing})"
                onmouseLeave="followButtonLeave('notification-button-${notifId}', '${authorAddress}', ${isFollowing})"
                style="width: 100%;" translate="yes">
            Follow
        </button>
    </div>
</div>`
                        notifList.append(notifHtml);
                        if (type === PUBLICATION.TYPE.FOLLOW) {
                            //console.log(type, name, description, isFollowing);
                            $('#notification-button-' + notifId).parent().removeClass('hidden');
                            makeFollowButton('notification-button-' + notifId, isFollowing);

                        } else if (contentAddress) {
                            $('#notification-' + notifId).attr('onmouseenter', "prepareArticle('" + contentAddress + "', '" + userAddress + "')");
                            $('#notification-description-' + notifId)
                                .addClass('cursor')
                                .attr('onclick', "showArticleModal()");
                        }
                    };

                    let notIndex = 0;

                    let processNotif = function (notif) {

                        let nextNotif = function () {
                            notIndex++;
                            if (notIndex < nots.length) {
                                processNotif(nots[notIndex]);
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

                                        onBuildNotif(notifId, notif.author, name, avatar, icon, description, momentDate, notif.type, false, notif.resource);
                                    }
                                    onLoaded();
                                    nextNotif();
                                });
                                break;
                            case PUBLICATION.TYPE.FOLLOW:
                                trantor.database.getAuthor(notif.author, userAddress, function (err, result) {
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
                                            onLoaded();
                                            nextNotif();
                                        })
                                    }
                                });
                                break;
                            case PUBLICATION.TYPE.LIKE:
                                trantor.database.getAuthor(notif.author, userAddress, function (err, result) {
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
                                        onBuildNotif(notifId, notif.author, name, avatar, icon, description, momentDate, notif.type, false, notif.resource);
                                    }
                                    onLoaded();
                                    nextNotif();
                                });
                                break;
                            case PUBLICATION.TYPE.COMMENT:
                                trantor.database.getAuthor(notif.author, userAddress, function (err, result) {
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
                                        onBuildNotif(notifId, notif.author, name, avatar, icon, description, momentDate, notif.type, false, notif.resource);
                                    }
                                    onLoaded();
                                    nextNotif();
                                });
                                break;
                            case PUBLICATION.TYPE.PAYMENT:
                                trantor.database.getAuthor(notif.author, userAddress, function (err, result) {
                                    if (err) {
                                        console.error(err);
                                    } else if (result.length > 0) {
                                        result = result[0];
                                        let notifId = Utils.makeHash(notif.author + notif.type + notif.resource + notif.on_date + notif.viewed);
                                        let momentDate = moment(notif.on_date, 'x').fromNow();
                                        let avatar = resolveAvatar(result.avatarFile, result.address);
                                        let name = result.name || lang.Anonymous;
                                        let icon = './assets/img/notification/wallet.png';
                                        let description = lang.NotifPayment;
                                        onBuildNotif(notifId, notif.author, name, avatar, icon, description, momentDate, notif.type, false, notif.resource);
                                    }
                                    onLoaded();
                                    nextNotif();
                                });
                                break;
                        }
                    };

                    processNotif(nots[notIndex]);

                } else {
                    loadingNotif = false;
                }
            }, 50);
        })
    }


}

function showArticleModal() {
    $('#modal-article').modal('show');
    return false;
}

function loadAllNotifications() {
    loadTopNotifications();
    loadPageNotifications();
}