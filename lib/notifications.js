let notifTopVueList = null;
let notifVueList = null;

let anonymousUser = {
    txid: null,
    version: 0,
    creation_date: 0,
    name: null,
    email: null,
    web: null,
    description: null,
    avatar: null,
    tags: []
};

trantor.on('core.started', function () {
    loadAllNotifications();
});

function showUserNotifications() {
    loadUserData();
    return showNotificationsView();
}

function loadTopNotifications() {
    getUserAddress(function (userAddress) {
        console.log('Notif get user address', userAddress);
        trantor.dbrunner.send('getUnviewedNotifications', 99999, function (err, nots) {
            console.log('Loading top notifications', err, nots);
            if (err) {
                console.error(err);
            } else {
                let topNotifications = [];

                if (!notifTopVueList) {
                    notifTopVueList = new Vue({
                        el: '#ui-top-notifications',
                        data: {
                            notifications: topNotifications,
                            total: nots.length,
                            lang: lang
                        },
                        methods: {
                            resolveAvatar: resolveAvatar,
                            resolveDate: function (date, format = null) {
                                if (format) {
                                    return moment(date, 'x').format(format);
                                }
                                return moment(date, 'x').fromNow();
                            },
                            showUserNotifications: function () {
                                if (notifTopVueList.$data.total <= 0) {
                                    return showUserNotifications();
                                }

                                return false;
                            }
                        }
                    })
                } else {
                    notifTopVueList.$data.notifications = topNotifications;
                    notifTopVueList.$data.total = nots.length;
                }

                let notIndex = 0;

                let processNotif = function (notif) {

                    let nextNotif = function () {
                        notIndex++;
                        if (notIndex < nots.length && notIndex <= 9) {
                            //console.log(nots[notIndex], notIndex);
                            processNotif(nots[notIndex]);
                        } else {
                            topNotifications.sort(function (n1, n2) {
                                return n2.on_date - n1.on_date;
                            });

                            notifTopVueList.$data.notifications = topNotifications;
                            notifTopVueList.$data.total = topNotifications.length;
                            notifTopVueList.$forceUpdate();
                        }
                    };

                    notif.id = Utils.makeHash(notif.author + notif.type + notif.resource + notif.on_date + notif.viewed);
                    //console.log(notif);
                    switch (notif.type) {
                        case TrantorConstants.TYPE.CONTENT:
                            trantor.dbrunner.send('getMediaByAddress', notif.resource, userAddress, function (err, result) {
                                if (err) {
                                    console.error(err);
                                } else if (result.length > 0) {
                                    result = result[0];
                                    notif.data = result;
                                    notif.isUpdate = result.author === CONSTANTS.UPDATE_USER;
                                    notif.icon = notif.isUpdate ? R.IMG.NOTIFICATION.UPDATE : R.IMG.NOTIFICATION.PUBLICATION;
                                    notif.description = notif.isUpdate ? lang.NewUpdate : lang.NotifNewContent;
                                    topNotifications.push(notif);
                                }
                                nextNotif();
                            });
                            break;
                        case TrantorConstants.TYPE.FOLLOW:
                            trantor.dbrunner.send('getAuthor', notif.author, userAddress, function (err, result) {
                                if (err) {
                                    console.error(err);
                                } else if (result.length > 0) {
                                    result = result[0];
                                } else {
                                    result = anonymousUser;
                                    result.address = notif.author
                                }

                                notif.data = result;
                                notif.icon = './assets/img/like0.png';
                                notif.description = lang.NotifFollowYou;
                                topNotifications.push(notif);

                                nextNotif();
                            });
                            break;
                        case TrantorConstants.TYPE.LIKE:
                            trantor.dbrunner.send('getAuthor', notif.author, userAddress, function (err, result) {
                                if (err) {
                                    console.error(err);
                                } else if (result.length > 0) {
                                    result = result[0];
                                } else {
                                    result = anonymousUser;
                                    result.address = notif.author
                                }

                                notif.data = result;
                                notif.icon = './assets/img/like0.png';
                                notif.description = lang.NotifLike;
                                topNotifications.push(notif);

                                nextNotif();
                            });
                            break;
                        case TrantorConstants.TYPE.COMMENT:
                            trantor.dbrunner.send('getAuthor', notif.author, userAddress, function (err, result) {
                                if (err) {
                                    console.error(err);
                                } else if (result.length > 0) {
                                    result = result[0];
                                } else {
                                    result = anonymousUser;
                                    result.address = notif.author
                                }

                                notif.data = result;
                                notif.icon = './assets/img/comments.png';
                                notif.description = lang.NotifComment;
                                topNotifications.push(notif);

                                nextNotif();
                            });
                            break;
                        case TrantorConstants.TYPE.PAYMENT:
                            trantor.dbrunner.send('getAuthor', notif.author, userAddress, function (err, result) {
                                if (err) {
                                    console.error(err);
                                } else if (result.length > 0) {
                                    result = result[0];
                                } else {
                                    result = anonymousUser;
                                    result.address = notif.author
                                }

                                notif.data = result;
                                notif.icon = R.IMG.NOTIFICATION.WALLET;
                                notif.description = lang.NotifPayment;
                                topNotifications.push(notif);

                                nextNotif();
                            });
                            break;
                    }
                };

                if (nots.length > 0) {
                    processNotif(nots[notIndex]);
                }

            }
        });
    });
}

function loadPageNotifications() {
    getUserAddress(function (userAddress) {
        trantor.dbrunner.send('getNotifications', 50, function (err, nots) {
            if (err) {
                console.error(err);
            } else {
                let notifications = [];

                if (!notifVueList) {
                    notifVueList = new Vue({
                        el: '#notifications-list',
                        data: {
                            notifications: notifications,
                            lang: lang
                        },
                        methods: {
                            resolveAvatar: resolveAvatar,
                            resolveDate: function (date, format = null) {
                                if (format) {
                                    return moment(date, 'x').format(format);
                                }
                                return moment(date, 'x').fromNow();
                            },
                            followButtonEnter: followButtonEnter,
                            followButtonLeave: followButtonLeave,
                            performFollow: performFollow,
                            onLoadUser: onLoadUser
                        }
                    })
                } else {
                    notifVueList.$data.notifications = notifications;
                }

                let notIndex = 0;

                let processNotif = function (notif) {

                    let nextNotif = function () {
                        notIndex++;
                        if (notIndex < nots.length) {
                            processNotif(nots[notIndex]);
                        } else {
                            notifications.sort(function (n1, n2) {
                                return n2.on_date - n1.on_date;
                            });

                            notifVueList.$data.notifications = notifications;
                        }
                    };

                    trantor.dbrunner.send('getAuthor', notif.author, userAddress, function (err, follows) {
                        if (err) {
                            console.log(err);
                        } else {
                            notif.id = Utils.makeHash(notif.author + notif.type + notif.resource + new Date().getTime() + notif.viewed);
                            notif.isFollowing = follows[0].user_following;
                            //console.log(notif.type, notif.isFollowing)
                            switch (notif.type) {
                                case TrantorConstants.TYPE.CONTENT:
                                    trantor.dbrunner.send('getMediaByAddress', notif.resource, userAddress, function (err, result) {
                                        if (err) {
                                            console.error(err);
                                        } else if (result.length > 0) {
                                            result = result[0];
                                            notif.data = result;
                                            notif.isUpdate = result.author === CONSTANTS.UPDATE_USER;
                                            notif.icon = notif.isUpdate ? R.IMG.NOTIFICATION.UPDATE : R.IMG.NOTIFICATION.PUBLICATION;
                                            notif.description = notif.isUpdate ? lang.NewUpdate : lang.NotifNewContent;

                                            notifications.push(notif);
                                        }

                                        nextNotif();
                                    });
                                    break;
                                case TrantorConstants.TYPE.FOLLOW:
                                    trantor.dbrunner.send('getAuthor', notif.author, userAddress, function (err, result) {
                                        if (err) {
                                            console.error(err);
                                        } else if (result.length > 0) {
                                            //console.log('Notif follow', result);
                                            result = result[0];
                                        } else {
                                            result = anonymousUser;
                                            result.address = notif.author;
                                        }

                                        notif.data = result;
                                        notif.icon = R.IMG.NOTIFICATION.PUBLICATION;
                                        notif.description = lang.NotifFollowYou;

                                        notifications.push(notif);
                                        nextNotif();
                                    });
                                    break;
                                case TrantorConstants.TYPE.LIKE:
                                    trantor.dbrunner.send('getAuthor', notif.author, userAddress, function (err, result) {
                                        if (err) {
                                            console.error(err);
                                        } else if (result.length > 0) {
                                            result = result[0];
                                        } else {
                                            result = anonymousUser;
                                            result.address = notif.author;
                                        }

                                        notif.data = result;
                                        notif.icon = './assets/img/like0.png';
                                        notif.description = lang.NotifLike;
                                        notifications.push(notif);
                                        nextNotif();
                                    });
                                    break;
                                case TrantorConstants.TYPE.COMMENT:
                                    trantor.dbrunner.send('getAuthor', notif.author, userAddress, function (err, result) {
                                        if (err) {
                                            console.error(err);
                                        } else if (result.length > 0) {
                                            result = result[0];
                                        } else {
                                            result = anonymousUser;
                                            result.address = notif.author;
                                        }

                                        notif.data = result;
                                        notif.icon = './assets/img/comments.png';
                                        notif.description = lang.NotifComment;
                                        notifications.push(notif);

                                        nextNotif();
                                    });
                                    break;
                                case TrantorConstants.TYPE.PAYMENT:
                                    trantor.dbrunner.send('getAuthor', notif.author, userAddress, function (err, result) {
                                        if (err) {
                                            console.error(err);
                                        } else if (result.length > 0) {
                                            result = result[0];
                                        } else {
                                            result = anonymousUser;
                                            result.address = notif.author;
                                        }

                                        notif.data = result;
                                        notif.icon = R.IMG.NOTIFICATION.WALLET;
                                        notif.description = lang.NotifPayment;
                                        notifications.push(notif);

                                        nextNotif();
                                    });
                                    break;
                            }
                        }
                    });
                };

                if (!nots.isEmpty()) {
                    processNotif(nots[notIndex]);
                }
            }
        });
    })
}

function showArticleModal() {
    $('#modal-article').modal('show');
    return false;
}

function loadAllNotifications() {
    setTimeout(function () {
        loadTopNotifications();
        loadPageNotifications();
    }, 400)

}