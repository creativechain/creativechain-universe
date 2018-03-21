let notifTopVueList = null;
let notifVueList = null;

trantor.events.on('onStart', function () {
    loadAllNotifications();
});

function showUserNotifications() {
    loadUserData();
    return showNotificationsView();
}
function loadTopNotifications() {
    getUserAddress(function (userAddress) {
        trantor.database.getUnviewedNotifications(function (err, nots) {
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

                                return true;
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
                            console.log(nots[notIndex], notIndex);
                            processNotif(nots[notIndex]);
                        } else {
                            topNotifications.sort(function (n1, n2) {
                                return n2.on_date - n1.on_date;
                            });

                            notifTopVueList.$data.notifications = topNotifications;
                        }
                    };

                    notif.id = Utils.makeHash(notif.author + notif.type + notif.resource + notif.on_date + notif.viewed);

                    switch (notif.type) {
                        case PUBLICATION.TYPE.CONTENT:
                            trantor.database.getMediaByAddress(notif.resource, userAddress, function (err, result) {
                                if (err) {
                                    console.error(err);
                                } else if (result.length > 0) {
                                    result = result[0];
                                    notif.data = result;
                                    notif.isUpdate = result.author === Constants.UPDATE_USER;
                                    notif.icon = notif.isUpdate ? R.IMG.NOTIFICATION.UPDATE : R.IMG.NOTIFICATION.PUBLICATION;
                                    notif.description = notif.isUpdate ? lang.NewUpdate : lang.NotifNewContent;
                                    topNotifications.push(notif);
                                }
                                nextNotif();
                            });
                            break;
                        case PUBLICATION.TYPE.FOLLOW:
                            trantor.database.getAuthor(notif.author, userAddress, function (err, result) {
                                if (err) {
                                    console.error(err);
                                } else if (result.length > 0) {
                                    result = result[0];
                                    notif.data = result;
                                    notif.icon = './assets/img/like0.png';
                                    notif.description = lang.NotifFollowYou;
                                    topNotifications.push(notif);
                                }

                                nextNotif();
                            });
                            break;
                        case PUBLICATION.TYPE.LIKE:
                            trantor.database.getAuthor(notif.author, userAddress, function (err, result) {
                                if (err) {
                                    console.error(err);
                                } else if (result.length > 0) {
                                    result = result[0];
                                    notif.data = result;
                                    notif.icon = './assets/img/like0.png';
                                    notif.description = lang.NotifLike;
                                    topNotifications.push(notif);
                                }

                                nextNotif();
                            });
                            break;
                        case PUBLICATION.TYPE.COMMENT:
                            trantor.database.getAuthor(notif.author, userAddress, function (err, result) {
                                if (err) {
                                    console.error(err);
                                } else if (result.length > 0) {
                                    result = result[0];

                                    notif.data = result;
                                    notif.icon = './assets/img/comments.png';
                                    notif.description = lang.NotifComment;
                                    topNotifications.push(notif);
                                }

                                nextNotif();
                            });
                            break;
                        case PUBLICATION.TYPE.PAYMENT:
                            trantor.database.getAuthor(notif.author, userAddress, function (err, result) {
                                if (err) {
                                    console.error(err);
                                } else if (result.length > 0) {
                                    result = result[0];

                                    notif.data = result;
                                    notif.icon = R.IMG.NOTIFICATION.WALLET;                                        notif.description = lang.NotifPayment;
                                    topNotifications.push(notif);
                                }

                                nextNotif();
                            });
                            break;
                    }
                };

                if (nots.length > 0) {
                    processNotif(nots[notIndex]);
                }

            }
        }, 99999);
    });
}

function loadPageNotifications() {
    getUserAddress(function (userAddress) {
        trantor.database.getNotifications(function (err, nots) {
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

                    trantor.database.getAuthor(notif.author, userAddress, function (err, follows) {
                        if (err) {
                            console.log(err);
                        } else {
                            notif.id = Utils.makeHash(notif.author + notif.type + notif.resource + new Date().getTime() + notif.viewed);
                            notif.isFollowing = follows[0].user_following;
                            //console.log(notif.type, notif.isFollowing)
                            switch (notif.type) {
                                case PUBLICATION.TYPE.CONTENT:
                                    trantor.database.getMediaByAddress(notif.resource, userAddress, function (err, result) {
                                        if (err) {
                                            console.error(err);
                                        } else if (result.length > 0) {
                                            result = result[0];
                                            notif.data = result;
                                            notif.isUpdate = result.author === Constants.UPDATE_USER;
                                            notif.icon = notif.isUpdate ? R.IMG.NOTIFICATION.UPDATE : R.IMG.NOTIFICATION.PUBLICATION;
                                            notif.description = notif.isUpdate ? lang.NewUpdate : lang.NotifNewContent;

                                            notifications.push(notif);
                                        }

                                        nextNotif();
                                    });
                                    break;
                                case PUBLICATION.TYPE.FOLLOW:
                                    trantor.database.getAuthor(notif.author, userAddress, function (err, result) {
                                        if (err) {
                                            console.error(err);
                                        } else if (result.length > 0) {
                                            //console.log('Notif follow', result);
                                            result = result[0];
                                            notif.data = result;
                                            notif.icon = R.IMG.NOTIFICATION.PUBLICATION;
                                            notif.description = lang.NotifFollowYou;

                                            notifications.push(notif);
                                            nextNotif();
                                        } else {
                                            //console.log('Notif follow, no data')
                                        }
                                    });
                                    break;
                                case PUBLICATION.TYPE.LIKE:
                                    trantor.database.getAuthor(notif.author, userAddress, function (err, result) {
                                        if (err) {
                                            console.error(err);
                                        } else if (result.length > 0) {
                                            result = result[0];

                                            notif.data = result;
                                            notif.icon = './assets/img/like0.png';
                                            notif.description = lang.NotifLike;
                                            notifications.push(notif);
                                        }

                                        nextNotif();
                                    });
                                    break;
                                case PUBLICATION.TYPE.COMMENT:
                                    trantor.database.getAuthor(notif.author, userAddress, function (err, result) {
                                        if (err) {
                                            console.error(err);
                                        } else if (result.length > 0) {
                                            result = result[0];

                                            notif.data = result;
                                            notif.icon = './assets/img/comments.png';
                                            notif.description = lang.NotifComment;
                                            notifications.push(notif);

                                        }

                                        nextNotif();
                                    });
                                    break;
                                case PUBLICATION.TYPE.PAYMENT:
                                    trantor.database.getAuthor(notif.author, userAddress, function (err, result) {
                                        if (err) {
                                            console.error(err);
                                        } else if (result.length > 0) {
                                            result = result[0];

                                            notif.data = result;
                                            notif.icon = R.IMG.NOTIFICATION.WALLET;
                                            notif.description = lang.NotifPayment;
                                            notifications.push(notif);
                                        }

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
        }, 50);
    })
}

function showArticleModal() {
    $('#modal-article').modal('show');
    return false;
}

function loadAllNotifications() {
    loadTopNotifications();
    loadPageNotifications();
}