let notifTopVueList = null;
let notifVueList = null;

trantor.events.subscribe('onStart', 'notifications', function () {
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
                loadingTopNotif = false;
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
                            }
                        }
                    })
                } else {
                    notifTopVueList.$data.notifications = topNotifications;
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
                                    notif.icon = R.IMG.NOTIFICATION.PUBLICATION;
                                    notif.description = lang.NotifNewContent;

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
                            }
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

                            notifVueList.$data.notifications.forEach(function (n) {
                                if (n.type === PUBLICATION.TYPE.FOLLOW) {

                                    $('#notification-button-' + n.id).parent().removeClass('hidden');
                                    makeFollowButton('notification-button-' + n.id, n.isFollowing);

                                } else if (n.type === PUBLICATION.TYPE.CONTENT) {
                                    $('#notification-' + n.id).attr('onmouseenter', "prepareArticle('" + n.resource + "', '" + userAddress + "')");
                                    $('#notification-description-' + n.id)
                                        .addClass('cursor')
                                        .attr('onclick', "showArticleModal()");
                                }
                            })

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
                                    notif.icon = R.IMG.NOTIFICATION.PUBLICATION;
                                    notif.description = lang.NotifNewContent;
                                    notif.isFollowing = false;

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

                                    result = result[0];
                                    notif.data = result;
                                    notif.icon = R.IMG.NOTIFICATION.PUBLICATION;
                                    notif.description = lang.NotifFollowYou;

                                    trantor.database.getFollowingData(userAddress, notif.author, notif.type, function (err, follows) {
                                        let following = false;
                                        if (err) {
                                            console.error(err)
                                        } else if (follows.length > 0) {
                                            following = true;
                                        }

                                        notif.isFollowing = following;

                                        notifications.push(notif);
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

                                    notif.data = result;
                                    notif.icon = './assets/img/like0.png';
                                    notif.description = lang.NotifLike;
                                    notif.isFollowing = false;
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
                                    notif.isFollowing = false;
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
                                    notif.isFollowing = false;
                                    notifications.push(notif);
                                }

                                nextNotif();
                            });
                            break;
                    }
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