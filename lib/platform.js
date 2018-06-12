
let followedList = $('#following-list');

let preparedArticle;
let payingArticle;
let articleVue;
let onSearch = false;
let mustReloadContent = false;
let mustReloadFollowers = false;
let mustReloadNotifications = false;
let pendingContent = {};
let pendingDownloads = {};
let discoverPage = 1;
let followingMediaPage = 1;

let followingVueList = null;
let articleVueList = null;

let latestVersion = null;
let latestUpdate = null;
let latestVersionAddress = null;
let versionsShowed = [];

let showingWindowsNotif = false;
let windowsNotifTimeout = null;
let platformLoaded = true;
let followingMediaLoaded = true;

let PAGES = {
    DISABLED: -1,
    DISCOVER: 0,
    FOLLOWING: 1,
    PROFILE_POSTS: 2,
};

let page = PAGES.FOLLOWING;
let lastPage = PAGES.DISABLED;

trantor.on('core.started', function () {
    console.log('onStart');
    modal.hide(false);
    init();
});

trantor.on('core.explore.finish', function (blockCount, blockHeight) {
    if (!onSearch) {
        loadMedia();
    }

    alertUpdate();
});

trantor.on('core.data', function (tx, data, blockTime) {
    //console.log('Data found', data);

    switch (data.type) {
        case TrantorConstants.TYPE.USER:
            trantor.dbrunner.addAuthor(data, tx, blockTime, function () {
                updateAuthor(data.address);

                getUserAddress(function (userAddress) {
                    trantor.dbrunner.getAuthor(data.address, userAddress, function (err, author) {
                        if (err) {
                            console.error(err);
                        } else if (author && (author.user_following || author.user_followed)){
                            mustReloadFollowers = true;
                            loadUserFollowedItems();
                            downloadAuthorAvatar(data.address, data.avatar);
                        }

                    });
                });

            });

            break;
        case TrantorConstants.TYPE.CONTENT:
            console.log(data);
            getUserAddress(function (userAddress) {

                let processNotBlock = function () {
                    //Media is not blocked

                    trantor.insertMedia(data, tx, blockTime, function (err, result) {
                        if (err) {
                            console.error(err)
                        } else {

                            let downloadPreviewImage = function () {
                                if (data.publicContent && data.publicContent.length > 0) {

                                    downloadPublicFile(data.contentAddress, data.publicContent);
                                }
                            };

                            if (data.userAddress === CONSTANTS.UPDATING_USER) {
                                console.log('New update!', data.title);
                                if (checkUpdate(data.contentAddress, data.title)) {
                                    trantor.dbrunner.insertNotification(data.userAddress, data.type, data.contentAddress, blockTime);
                                    loadAllNotifications();
                                }
                            }

                            trantor.dbrunner.getAuthor(data.userAddress, userAddress, function (err, result) {
                                if (err) {
                                    console.error(err);
                                } else if (result.length > 0) {
                                    let author = result[0];
                                    mustReloadContent = (page === PAGES.FOLLOWING && author.user_following) || page === PAGES.DISCOVER;
                                    console.log('User is following', author.name, author.user_following, 'Reload:', mustReloadContent);
                                    updateMediaItemView(data.contentAddress, userAddress, mustReloadContent);
                                    updateAuthor(data.userAddress);

                                    if (mustReloadContent) {
                                        downloadPreviewImage();
                                    }

                                }
                            });


                        }
                    });
                };

                //Block content and authors
                trantor.dbrunner.getFollowingData(userAddress, data.author, TrantorConstants.TYPE.BLOCK, function (err, result) {
                    if (err) {
                        console.error(err);
                    } else if (result.length <= 0) {
                        trantor.dbrunner.getFollowingData(userAddress, data.address, TrantorConstants.TYPE.BLOCK, function (err, result) {
                            if (err) {
                                console.error(err);
                            } else if (result.length <= 0) {
                                processNotBlock();
                            }
                        })
                    }
                })

            });
            break;
        case TrantorConstants.TYPE.COMMENT:
            getUserAddress(function (userAddress) {
                trantor.insertComment(data, tx, blockTime, function () {
                    updateMediaItemView(data.contentAddress, userAddress);
                    updateAuthor(data.author);

                });

                trantor.dbrunner.getMediaByAddress(data.contentAddress, userAddress, function (err, result) {
                    if (err) {
                        console.error(err);
                    } else if (result.length > 0) {
                        let media = result[0];

                        //Only notify if author is not the user
                        if (media.author === userAddress && userAddress !== data.author) {
                            trantor.dbrunner.insertNotification(data.author, data.type, data.contentAddress, blockTime);
                            loadAllNotifications();
                        }
                    }
                });

            });
            break;
        case TrantorConstants.TYPE.LIKE:

            getUserAddress(function (userAddress) {
                trantor.dbrunner.addLike(data, tx, function () {
                    updateMediaItemView(data.contentAddress, userAddress);
                    updateAuthor(data.author);
                });

                trantor.dbrunner.getMediaByAddress(data.contentAddress, userAddress, function (err, result) {
                    if (err) {
                        console.error(err);
                    } else if (result.length > 0) {
                        let media = result[0];

                        //Only notify if author is not the user
                        if (media.author === userAddress && userAddress !== data.author) {
                            trantor.dbrunner.insertNotification(data.author, data.type, data.contentAddress, blockTime);
                            loadAllNotifications();
                        }
                    }
                });

            });

            break;
        case TrantorConstants.TYPE.UNLIKE:
            getUserAddress(function (userAddress) {
                trantor.dbrunner.addUnlike(data, tx, function () {
                    //TODO: SHOW UNLIKES ?
                });
            });
            break;
        case TrantorConstants.TYPE.PAYMENT:
            getUserAddress(function (userAddress) {
                trantor.dbrunner.addPayment(data, tx, function () {
                    updateMediaItemView(data.contentAddress, userAddress);
                    updateAuthor(data.author);
                });

                trantor.dbrunner.getMediaByAddress(data.contentAddress, userAddress, function (err, result) {
                    if (err) {
                        console.error(err);
                    } else if (result.length > 0) {
                        //console.log(result);
                        result = result[0];

                        //Download private file only if file is not exist
                        if (userAddress === data.author && !File.exist(data.private_file)) {
                            downloadPrivateContent(result, tx.hash);
                        }

                        //Only notify if author is not the user
                        if (userAddress === result.author && userAddress !== data.author) {
                            console.log('Payment received!');
                            trantor.dbrunner.insertNotification(data.author, data.type, data.contentAddress, blockTime);
                            loadAllNotifications();
                        }
                    }
                });

            });
            break;
        case TrantorConstants.TYPE.FOLLOW:
        case TrantorConstants.TYPE.UNFOLLOW:
        case TrantorConstants.TYPE.BLOCK:
            getUserAddress(function (userAddress) {
                trantor.dbrunner.addFollowing(data, tx, blockTime, function () {
                    if (data.type === TrantorConstants.TYPE.UNFOLLOW) {
                        trantor.dbrunner.removeFollowing(data);
                    } else if (data.type === TrantorConstants.TYPE.BLOCK && data.followerAddress === userAddress) {
                        //mustReloadContent = true;
                        loadMedia();
                        loadMoreProfileMedia(loadedProfile);
                        loadBlockeds();
                    }

                    loadUserFollowedItems();
                    updateAuthor(data.followedAddress);
                });

                if (data.type === TrantorConstants.TYPE.FOLLOW) {
                    if (data.followedAddress === userAddress) {
                        trantor.dbrunner.insertNotification(data.followerAddress, data.type, data.followedAddress, blockTime);
                        trantor.dbrunner.getFollowingData(userAddress, data.followedAddress, TrantorConstants.TYPE.FOLLOW, function (err, result) {
                            if (err) {
                                console.error(err)
                            } else if (result.length > 0) {
                                let data = result[0];
                                //loadUserFollowed(data);
                            }
                        });
                    }
                }
            });
    }

});

trantor.on('core.comment.build', function (txBuilt, comment) {
    console.log(txBuilt, comment);
    signAndSendTx(txBuilt.hex, function (err, txid, signedTx) {
        if (err) {
            handleRpcError(err);
        } else {
            trantor.emit('core.notification', lang.CommentPublished, lang.CommentPublishedSuccessfully, './assets/img/publications1.png', 5);
            let tx = DecodedTransaction.fromHex(signedTx, trantor.configuration.network);
            trantor.emit('core.comment.sent', tx, comment);
        }
    })

});

trantor.on('core.comment.sent', function (tx, comment) {
    trantor.insertComment(comment, tx, new Date().getTime(), function (err) {
        if (err) {
            console.error(err);
        } else {
            console.log('Comment inserted!');
            $('#article-comment').val('');
            getUserAddress(function (userAddress) {
                updateMediaItemView(comment.contentAddress, userAddress);
                updateAuthor(comment.author);
            });

        }
    });

    mustReloadContent = true;
});

trantor.on('core.publication.sent', function (tx, media) {
    trantor.insertMedia(media, tx, new Date().getTime(), function (err) {
        if (err) {
            console.error(err);
            modal.error({
                message: err
            })
        } else {
            getUserAddress(function (userAddress) {
                updateMediaItemView(media.contentAddress, userAddress, true);
                updateAuthor(media.author);
            });
        }
    });

    mustReloadContent = true;
});

trantor.on('core.like.build', function (txBuffer, like) {

    console.log('core.like.build', txBuffer, like);

    signAndSendTx(txBuffer.hex, function (err, result, signedTx) {
        if (err) {
            console.log(err);
        } else {
            console.log('Like sended', result);
            let tx = DecodedTransaction.fromHex(signedTx);
            trantor.emit('core.like.sent', tx, like);
        }
    });
});

trantor.on('core.like.sent', function (tx, like) {

    trantor.dbrunner.addLike(like, tx, function (err) {
        if (err) {
            console.error(err);
        } else {
            getUserAddress(function (userAddress) {
                updateMediaItemView(like.contentAddress, userAddress);
                updateAuthor(like.author);
            });

        }
    });
});

/**
 *
 * @param {TransactionBuilder} txBuilder
 * @param {Array} spendables
 */
trantor.on('core.transaction.build', function (builtTx) {
    let dTx = DecodedTransaction.fromHex(builtTx.hex, trantor.configuration.network);

    let totalOut = dTx.getTotalOut(builtTx.changepos);

    let fee = Coin.parseCash(builtTx.fee, 'CREA');
    totalOut = Coin.parseCash(totalOut, 'CREA');

    let total = fee.amount + totalOut.amount;
    total = Coin.parseCash(total, 'CREA');

    console.log(builtTx, totalOut, fee, total);
    let txMessage = String.format(lang.TxSendMessage, totalOut.toFriendlyString(), fee.toFriendlyString(), total.toFriendlyString());
    modal.alert({
        message: txMessage,
        ok: {
            text: lang.Send,
            onclick: function () {
                modal.hide(true);
                signAndSendTx(builtTx.hex, function (err, txid, signedTx) {
                    if (err) {
                        handleRpcError(err);
                    } else {
                        refreshWallet();
                        //console.log(result);
                        modal.alert({
                            message: lang.TransactionSend + '\n' + txid
                        });

                        clearSendFields();
                        if (!OS.isWindows8Or10()) {
                            trantor.emit('core.transaction.sent', txid);
                        }
                    }
                });

            }
        },
        cancel: {
            text: lang.Cancel,
            onclick: function () {

            }
        }
    });
});

/**
 *
 * @param {DecodedTransaction} tx
 */
trantor.on('core.transaction.sent',function (tx) {
    trantor.emit('core.notification', lang.TransactionSend, tx, './assets/img/notification/wallet.png', 2);
});

trantor.on('core.avatar.ready', function (authorAddress, torrent) {

    updateAuthor(authorAddress);
    mustReloadFollowers = true;
    loadProfileFollows();

});

trantor.on('core.file.ready', function (contentAddress, torrent) {

    getUserAddress(function (userAddress) {
        updateMediaItemView(contentAddress, userAddress, false);
        updatePreparedArticle(contentAddress, userAddress);

        if (pendingContent[contentAddress] && pendingContent[contentAddress].pending) {
            trantor.dbrunner.getMediaByAddress(contentAddress, userAddress, function (err, result) {
                if (err) {
                    console.error(err);
                } else if (result.length > 0) {
                    result = result[0];
                    let body = String.format(lang.DownloadFinishedBody, result.title);
                    trantor.emit('core.notification', lang.DownloadFinished, body, './assets/img/notifications.png', 10);
                    delete pendingDownloads[contentAddress];

                }
            });
        }
    });


});

trantor.on('core.payment.build', function (builtTx, payment) {

    let dTx = DecodedTransaction.fromHex(builtTx.hex);
    let fee = Coin.parseCash(builtTx.fee, 'CREA');
    let totalOutAmount = Coin.parseCash(dTx.getTotalOutput(), 'CREA');
    let totalAmount = Coin.parseCash(totalOutAmount.amount + fee.amount, 'CREA');
    console.log(dTx, builtTx);

    let paymentBody = String.format(lang.PaymentBody, totalOutAmount.toFriendlyString(), fee.toFriendlyString(), totalAmount.toFriendlyString());
    modal.alert({
        message: paymentBody,
        ok: {
            onclick: function () {
                signAndSendTx(builtTx.hex, function (err, txid, signedTx) {
                    if (err) {
                        handleRpcError(err);
                    } else {
                        console.log(txid);
                        dTx = DecodedTransaction.fromHex(signedTx);
                        trantor.dbrunner.addPayment(payment, dTx, function (err, result) {
                            if (err) {
                                console.error(err);
                            } else {
                                trantor.emit('core.notification', lang.Payment, lang.PaymentSent, './assets/img/notification/wallet.png', 10);
                                getUserAddress(function (userAddress) {

                                    if (payingArticle) {
                                        showModalArticle();
                                        prepareArticle(payingArticle.address, userAddress);
                                    }

                                    trantor.dbrunner.getMediaByAddress(payment.contentAddress, userAddress, function (err, medias) {
                                        if (err) {
                                            console.log(err);
                                        } else {
                                            let m = medias[0];
                                            console.log(m, txid);
                                            downloadPrivateContent(m, txid);
                                        }
                                    })
                                })

                            }
                        })
                    }

                });
            }
        },
        cancel: {
            text: lang.Cancel,
            onclick: function () {
                if (payingArticle) {
                    getUserAddress(function (userAddress) {
                        showModalArticle();
                        setTimeout(function () {
                            prepareArticle(payingArticle.address, userAddress);
                        }, 400);
                    });

                }
            }
        }
    });

});



trantor.on('core.follow.build', function (txBuilt, data) {

    signAndSendTx(txBuilt.hex, function (err, txid, signedTx) {
        if (err) {
            handleRpcError(err);
        } else {
            console.log('Follow performed!');
            let dTx = DecodedTransaction.fromHex(signedTx);
            trantor.dbrunner.addFollowing(data, dTx, new Date().getTime(), function () {
                updateAuthor(data.followedAddress);
                trantor.dbrunner.getAllMediaByAuthor(data.followedAddress, data.followerAddress, function (err, result) {
                    if (err) {
                        console.error(err);
                    } else if (result.length > 0) {
                        result.forEach(function (media) {
                            updateMediaItemView(media.address, data.followerAddress);
                        });
                    }
                });

                mustReloadFollowers = true;
                loadUserFollowedItems();
            });
        }
    });
});



trantor.on('core.unfollow.build', function (txBuilt, data) {

    signAndSendTx(txBuilt.hex, function (err, txid, signedTx) {
        if (err) {
            handleRpcError(err)
        } else {
            let dTx = DecodedTraansaction.fromHex(signedTx, trantor.configuration.network);
            trantor.dbrunner.addFollowing(data, dTx, new Date().getTime(), function () {
                trantor.dbrunner.removeFollowing(data);
                updateAuthor(data.followedAddress);
                trantor.dbrunner.getAllMediaByAuthor(data.followedAddress, data.followerAddress, function (err, result) {
                    if (err) {
                        console.error(err);
                    } else if (result.length > 0) {
                        result.forEach(function (media) {
                            updateMediaItemView(media.address, data.followerAddress);
                        });
                    }
                });

                mustReloadFollowers = true;
                loadUserFollowedItems();
            });
        }
    });
});

trantor.on('core.file.downloaded', function (contentAddress, data) {

    if (pendingContent[contentAddress] && pendingContent[contentAddress].pending) {
        getUserAddress(function (userAddress) {
            updatePreparedArticle(contentAddress, userAddress);

            trantor.dbrunner.getMediaByAddress(contentAddress, userAddress, function (err, result) {
                if (err) {
                    console.error(err);
                } else {
                    result = result[0];

                    let title = lang.DownloadFinished;
                    let msg = String.format(lang.DownloadFinishedBody, result.title);
                    trantor.emit('core.notification', title, msg, R.IMG.NOTIFICATION.DOWNLOAD, 3);
                }
            })
        });
    }
});

trantor.on('core.log', function () {
    console.log.apply(console, arguments);
});

trantor.on('core.notification', function (title, body, icon, duration) {

    if (OS.isWindows8Or10()) {
        showWinNotif(body, duration)
    } else {
        Notifications.notify(title, body, icon, duration);
    }

});

function showWinNotif(body, duration) {
    let winNotif = $('#win-notification');
    let winNotifText = $('#win-notification-text');
    let winNotifClose = $('#win-notification-close');

    let closeNotif = function () {
        winNotif.removeClass('efect-alert-footer');
        showingWindowsNotif = false;
    };

    if (showingWindowsNotif) {
        if (windowsNotifTimeout) {
            clearTimeout(windowsNotifTimeout);
        }
    }

    body = body || '----';
    winNotifText.html(body);
    winNotifClose.unbind('click')
        .click(function () {
            closeNotif();
        });

    if (duration) {
        duration = duration * 1000;
        windowsNotifTimeout = setTimeout(function () {
            closeNotif();
        }, duration)
    }

    if (!showingWindowsNotif) {
        winNotif.addClass('efect-alert-footer');
        showingWindowsNotif = true;
    }
}

trantor.on('core.loading', function () {
    modal.loading(lang.LoadingResources);
});

trantor.on('core.error', function () {
    let error = arguments[0];

    let errorMessage = null;

    if (error.name && error.name === 'RpcError') {
        handleRpcError(error);
    } else {
        switch (error) {
            case ErrorCodes.NOT_SPENDABLES:
                errorMessage = lang.WalletPendingEntries;
                break;
            case ErrorCodes.INSUFFICIENT_AMOUNT:
                errorMessage = lang.InsuficientAmount;
                break;
            default:

                errorMessage = error.message;
        }

        if (errorMessage) {
            modal.hide();
            modal.error({
                message: errorMessage,
            })
        }
        console.error.apply(console, arguments);
    }

});

function init() {
    mustReloadFollowers = true;
    mustReloadContent = true;
    mustReloadNotifications = true;

    showMedia();
    loadUserFollowedItems();
    loadAbout();
}

function loadMedia() {
    if (mustReloadContent) {
        if (followingMediaLoaded) {
            loadFollowingMedia();
        } else {
            loadAllMedia();
        }

        mustReloadContent = false;
    }
}

function reloadNotifications() {
    if (mustReloadNotifications) {
        loadAllNotifications();
        mustReloadNotifications = false;
    }
}

function alertUpdate() {
    if (latestVersion && !versionsShowed.includes(latestVersion)) {
        versionsShowed.push(latestVersion);
        let message = lang.NewUpdateMessage;
        message = String.format(message, latestUpdate);
        modal.alert({
            title: lang.NewUpdate,
            message: message,
            img: R.IMG.COMMON.UPDATE,
            ok: {
                text: lang.UpdateNow,
                onclick: function () {
                    getUserAddress(function (userAddress) {
                        prepareArticle(latestVersionAddress, userAddress);
                        showArticleModal();
                    });
                }
            },
            cancel: {
                text: lang.UpdateLater,
                onclick: function () {
                    modal.hide();
                }
            }
        })
    }

}


/**
 *
 * @param {string} contentAddress
 * @param {string} newUpdate
 * @return {boolean}
 */
function checkUpdate(contentAddress, newUpdate) {
    let v = newUpdate.match(/(v\d+(\.\d)*)/i);
    if (OS.isLinux()) {
        if (!newUpdate.toLowerCase().includes('linux')) {
            v = false;
            console.log('No Linux well update');
        } else {
            console.log('Well Linux update');
        }
    } else if (OS.isMac()) {
        if ((!newUpdate.toLowerCase().includes('mac') && !newUpdate.toLowerCase().includes('darwin'))) {
            v = false;
            console.log('No Mac well update');
        } else {
            console.log('Well Mac update');
        }
    } else if (OS.isWindows()) {
        if (!newUpdate.toLowerCase().includes('windows')) {
            v = false;
            console.log('No Windows well update');
        } else {
            console.log('Well Windows update');
        }
    }

    if (v && v.length > 0) {
        let version = v[0];
        if (checkNewVersion(version)) {
            if (!latestVersion || compareVersions(latestVersion, version)) {
                latestVersion = version;
                latestUpdate = newUpdate;
                latestVersionAddress = contentAddress;
                return true;
            } else {
                console.log('No update version', version);
            }
        } else {
            console.log('No well version');
        }
    }

    return false;
}

/**
 *
 * @param {string} oldVersion
 * @param {string} newVersion
 * @return {*}
 */
function compareVersions(oldVersion, newVersion) {
    console.log(newVersion, '>', oldVersion, '=', semver.gt(newVersion, oldVersion));
    if (semver.gt(newVersion, oldVersion)) {
        return newVersion;
    }

    return null;
}

/**
 *
 * @param {string} version
 * @return {*}
 */
function checkNewVersion(version) {

    let newVersion = semver.valid(semver.coerce(version));

    if (newVersion) {
        let packageVersion = semver.valid(pjson.version);
        return compareVersions(packageVersion, newVersion);
    } else {
        console.error('Version', version, 'is not valid.')
    }

    return null;
}

function loadAbout() {
    let buildVersion = pjson.buildVersion;
    let version = pjson.version;
    if (!buildVersion.isEmpty()) {
        version = version + '-' + buildVersion;
    }

    version = version + ' ' + lang.VersionName;
    let osname = (OS.getPlatform() + ' ' + OS.getRelease() + ' ' + OS.getArch()).capitalize();

    $('#about-version').html(version.capitalize());
    $('#about-system').html(osname);
}

function updateAuthor(authorAddress) {
    getUserAddress(function (userAddress) {
        //Update profile if this is showing;
        updateAuthorProfile(authorAddress);

        //Update all author publications
        trantor.dbrunner.getMediaAddressByAuthor(authorAddress, function (err, mediaAddresses) {
            if (err) {
                console.error(err);
            } else {
                mediaAddresses.forEach(function (mediaAddress) {
                    updateMediaItemView(mediaAddress, userAddress);
                })
            }
        });
    });
}
function updateMediaItemView(mediaAddress, userAddress, forceAdd = false) {
    updateMediaItem(mediaAddress, userAddress, forceAdd);
    updateProfileMediaItem(mediaAddress, userAddress, forceAdd);
    updatePreparedArticle(mediaAddress, userAddress);
}

function updateMediaItem(address, userAddress, forceAdd = true) {
    trantor.dbrunner.getMediaByAddress(address, userAddress, function (err, result) {
        //console.log(address, result);
        if (result.length > 0) {
            let data = result[0];

            let added = false;
            for (let x = 0; x < articleVueList.$data.publications.length; x++) {
                let m = articleVueList.$data.publications[x];
                if (m.address === address) {
                    articleVueList.$data.publications[x] = data;
                    added = true;
                    break;
                }
            }

            if (!added && forceAdd) {
                articleVueList.$data.publications.unshift(data);
                added = true;
            }

            if (added) {
                if (!data.featured_image || !File.exist(data.featured_image)) {
                    downloadPublicFile(data.address, data.public_content)
                }

                if (!data.avatarFile || !File.exist(data.avatarFile)) {
                    downloadAuthorAvatar(data.author, data.avatar)
                }
            }

            articleVueList.$forceUpdate();
        }
    });

}

function showSearch(result, userAddress) {
    articleVueList.$data.publications = result;
    articleVueList.$data.userAddress = userAddress;
}

function downloadAuthorAvatar(authorAddress, avatarMagnet) {
    if (avatarMagnet && avatarMagnet.length > 0) {
        console.log('Downloading avatar', authorAddress, avatarMagnet);
        trantor.ipfsrunner.downloadFile(authorAddress, avatarMagnet, false, function (data, file, address) {
            //console.log('author torrent', avatarMagnet);
            let tHash = Utils.makeHash(avatarMagnet);
            trantor.dbrunner.putTorrent(tHash, avatarMagnet, data.path, file);
            trantor.emit('core.avatar.ready', authorAddress, data);

            getUserAddress(function (userAddress) {
                trantor.dbrunner.getAllMediaByAuthor(authorAddress, userAddress, function (err, result) {
                    if (err) {
                        console.error(err);
                    } else if (result.length > 0) {
                        result.forEach(function (data) {
                            updateMediaItem(data.address, userAddress, false)

                        });

                        if (result[0].following) {
                            updateUserFollows(authorAddress);
                        }
                    }
                });
            })
        })
    }

}

/**
 *
 * @param {string} contentAddress
 * @param {string} magnet
 */
function downloadPublicFile(contentAddress, magnet) {
    if (magnet && magnet.length > 0) {
        //console.log('Adding torrent', magnet);
        trantor.ipfsrunner.downloadFile(contentAddress, magnet, false, function (torrent, file, contentAddress) {
            let tHash = Utils.makeHash(torrent.CID);
            trantor.dbrunner.putTorrent(tHash, magnet, torrent.path, file);
            console.log('File donwnloaded', contentAddress, magnet);
            getUserAddress(function (userAddress) {
                updateMediaItem(contentAddress, userAddress);
                updateProfileMediaItem(contentAddress, userAddress);
                if (mustReloadContent) {
                    mustReloadContent = false;
                }
            });
        });
    }

}

function performFollow(address) {
    getUserAddress(function (userAddress) {
        if (address !== userAddress) {
            trantor.dbrunner.getFollowingData(userAddress, address, TrantorConstants.TYPE.FOLLOW, function (err, result) {
                if (err) {
                    console.error(err);
                } else if (result.length > 0) {
                    unFollowUser(address);
                } else {
                    followUser(address);
                }
            })
        }
    });
}

function showMediaResults(results, userAddress, add = false) {

    if (!articleVueList) {
        articleVueList = new Vue({
            el: '#ui-posts-list',
            data: {
                publications: results,
                userAddress: userAddress,
                lang: lang,
                icons: {
                    NORMAL: './assets/img/like0.png',
                    FILLED: './assets/img/like2.png',
                    OVER: './assets/img/like-border.png',
                }
            },
            methods: {
                resolveAvatar: resolveAvatar,
                getDefaultImageAndColor: getDefaultImageAndColor,
                getBuzz: function(user_creation_date, user_likes, user_comments, publications, followers, actions = 0) {
                    return BUZZ.getBuzz(user_creation_date, user_likes, user_comments, publications, followers, actions)
                },
                loadProfileData: loadProfileData,
                followButtonEnter: followButtonEnter,
                followButtonLeave: followButtonLeave,
                performFollow: performFollow,
                makeLike: makeLike,
                getLikeIcon: function (liked) {
                    return liked ? this.icons.FILLED : this.icons.NORMAL;
                },
                likeEnter: function (buttonId, liked) {

                    let b = $('#' + buttonId);
                    if (liked) {
                        b.attr('src', this.icons.FILLED);
                    } else {
                        b.attr('src', this.icons.OVER);
                    }


                },
                likeLeave: function (buttonId, liked) {

                    let b = $('#' + buttonId);
                    if (liked) {
                        b.attr('src', this.icons.FILLED);
                    } else {
                        b.attr('src', this.icons.NORMAL);
                    }
                }
            }
        })
    } else {

        if (add) {
            results.forEach(function (m) {
                articleVueList.$data.publications.push(m);
            });
        } else {
            articleVueList.$data.publications = results;
        }
    }

    results.forEach(function (data) {
        if (!data.featured_image || !File.exist(data.featured_image)) {
            downloadPublicFile(data.address, data.public_content)
        }

        if (!data.avatarFile || !File.exist(data.avatarFile)) {
            downloadAuthorAvatar(data.author, data.avatar)
        }
    })
}

function removeContent(contentAddress) {
    let length = articleVueList.$data.publications.length;
    for (let x = 0; x < length; x++) {
        let post = articleVueList.$data.publications[x];
        if (post.address === contentAddress) {
            articleVueList.$data.publications.splice(x, 1);
            break;
        }
    }
}

function loadAllMedia() {
    let uiPosts = $('#ui-posts');
    if (uiPosts.is(':visible')) {
        if (!onSearch) {
            if (!trantor.isExploring) {
                console.log('showing blockcloading');
                modal.blockLoading(lang.LoadingContent);
            }

            getUserAddress(function (userAddress) {
                trantor.dbrunner.getAllMedia(userAddress, discoverPage, function (err, result) {
                    if (err) {
                        console.error(err);
                    } else {
                        followingMediaLoaded = false;
                        showMediaResults(result, userAddress);
                        if (!trantor.isExploring) {
                            modal.blockLoading(null, false);
                        }
                    }
                });
            })
        }
    }

}

function loadMorePage() {

    switch (page) {
        case PAGES.DISCOVER:
            loadMoreDiscoverMedia();
            break;
        case PAGES.FOLLOWING:
            loadMoreFollowingMedia();
            break;
        case PAGES.PROFILE_POSTS:
            loadMoreProfileMedia(loadedProfile);
            break;

    }
}

function loadMoreDiscoverMedia() {
    discoverPage++;
    getUserAddress(function (userAddress) {
        trantor.dbrunner.getAllMedia(userAddress, discoverPage, function (err, results) {
            if (err) {
                console.error(err);
            } else if (results.length > 0) {
                showMediaResults(results, userAddress, true);
            } else {
                discoverPage--;
            }
        });

        mustReloadContent = false;
    })
}

function loadMoreFollowingMedia() {
    followingMediaPage++;
    getUserAddress(function (userAddress) {
        trantor.dbrunner.getMediaByFollowerAddress(userAddress, userAddress, followingMediaPage, function (err, results) {

            if (err) {
                console.error(err);
            } else if (results.length > 0) {
                showMediaResults(results, userAddress, true);
            } else {
                followingMediaPage--;
            }
        });

        mustReloadContent = false;
    })
}

function loadFollowingMedia() {
    let uiPosts = $('#ui-posts');
    if (uiPosts.is(':visible')) {
        if (!trantor.isExploring) {
            console.log('showing block loading');
            modal.blockLoading(lang.LoadingContent);
        }

        getUserAddress(function (userAddress) {
            trantor.dbrunner.getMediaByFollowerAddress(userAddress, userAddress, followingMediaPage, function (err, result) {
                if (err) {
                    console.error(err);
                } else {
                    followingMediaLoaded = true;
                    showMediaResults(result, userAddress);
                    if (!trantor.isExploring) {
                        modal.blockLoading(null, false);
                    }
                }
            });

        });
    }
}

function showLatestMedia() {
    showExploreView('#ui-main-filter-discover');
    mustReloadContent = true;
    page = PAGES.DISCOVER;
    discoverPage = 1;
    loadAllMedia();
    return false;
}

function showFollowingMedia() {
    showExploreView('#ui-main-filter-following');
    page = PAGES.FOLLOWING;
    followingMediaPage = 1;
    loadFollowingMedia();
    return false;
}

function showMedia() {
    if (followingMediaLoaded) {
        return showFollowingMedia();
    }

    return showLatestMedia();
}

function loadUserFollowedItems() {
    if (mustReloadFollowers) {
        loadProfileFollows();
        mustReloadFollowers = false;

        getUserAddress(function (userAddress) {
            trantor.dbrunner.getFollowing(userAddress, userAddress, function (err, result) {

                if (err) {
                    console.error(err);
                } else {
                    if (!followingVueList) {
                        followingVueList = new Vue({
                            el: '#following-list',
                            data: {
                                follows: result,
                                lang: lang
                            },
                            methods: {
                                resolveAvatar: resolveAvatar
                            }
                        })
                    } else {
                        followingVueList.$data.follows = result;
                    }

                    if (result.length > 0) {
                        //console.log(result);
                        followedList.removeClass('hidden');
                        $('#ui-no-follow').addClass('hidden');
                    } else {
                        followedList.addClass('hidden');
                        $('#ui-no-follow').removeClass('hidden');
                    }

                    result.forEach(function (followed) {
                        if (!followed.avatarFile || !File.exist(followed.avatarFile) || File.fileInfo(followed.avatarFile).size <= 0) {
                            downloadAuthorAvatar(followed.address, followed.avatar);
                        }
                    });

                    followingVueList.$forceUpdate();
                    mustReloadFollowers = true;
                }

            });
        });
    }
}

function onLoadUser(address) {
    getUserAddress(function (userAddress) {
        let isUser = address === userAddress;
        loadProfileData(address, isUser);
        showProfileView();
    });
}

function updateUserFollows(followedAddress) {
    getUserAddress(function (userAddress) {
        trantor.dbrunner.getFollowingData(userAddress, followedAddress, TrantorConstants.TYPE.FOLLOW, function (err, result) {

            if (err) {
                console.error(err);
            } else if (result.length > 0) {
                let data = result[0];

                let added = false;
                for (let x = 0; x < followingVueList.$data.follows.length; x++) {
                    let i = followingVueList.$data.follows[x];
                    if (i.followed_address === data.followed_address) {
                        followingVueList.$data.follows[x] = data;
                        added = true;
                        break;
                    }
                }

                if (!added) {
                    followingVueList.$data.follows.unshift(data);
                }

                followingVueList.$forceUpdate();

            }

        });
    })
}

function updatePreparedArticle(mediaAddress, userAddress) {
    if (preparedArticle && preparedArticle.address === mediaAddress) {
        prepareArticle(mediaAddress, userAddress);
    }
}

function loadArticle(result, userAddress) {
    console.log(result);
    if (Array.isArray(result)) {
        preparedArticle = result[0];
    } else {
        preparedArticle = result;
    }

    let mediaAddress = preparedArticle.address;
    let license = getLicenseData(preparedArticle.license);
    let price = Coin.parseCash(preparedArticle.price, 'CREA');
    preparedArticle.priceString = !price.isZero() && preparedArticle.private_content ?
        Coin.parseCash(preparedArticle.price, 'CREA').toFriendlyString() : lang.FreeDownload;

    if (!articleVue) {
        articleVue = new Vue({
            el: '#modal-article',
            data: {
                article: preparedArticle,
                comments: [],
                license: license,
                lang: lang,
                userAddress: userAddress,
                userAvatar: R.IMG.DEFAULT_AVATAR[0],
                featuredImage: getDefaultImageAndColor(preparedArticle.content_type, preparedArticle.featured_image),
                icons: {
                    NORMAL: './assets/img/modal/icon-like.png',
                    FILLED: './assets/img/modal/icon-like-filled.png',
                    OVER: './assets/img/modal/icon-like-border.png',
                },
            },
            updated: function () {
                this.$nextTick(function () {
                    $('#article-edit-button').html(this.lang.Edit);
                    $('#article-follow-button').html(this.lang.Follow);
                    $('#article-follow-following-button').html(this.lang.Following);
                })
            },
            methods: {
                resolveAvatar: resolveAvatar,
                getBuzz: function () {
                    return BUZZ.getBuzz(this.article.user_creation_date, this.article.user_likes, this.article.user_comments, this.article.publications, this.article.user_followers, 0);
                },
                resolveDate: function (date, format = null) {
                    if (format) {
                        return moment(date).format(format);
                    }
                    return moment(date).fromNow();
                },
                size: function () {
                    if (preparedArticle.private_content) {
                        return File.formatSize(preparedArticle.prv_file_size);
                    } else if (preparedArticle.public_content) {
                        return File.formatSize(preparedArticle.pub_file_size);
                    }
                    return '0.00 B';
                },
                publishComment: publishComment,
                openUrlInBrowser: function (url) {
                    openUrlInBrowser(url);
                    return false;
                },
                makeLike: makeLike,
                getLikeIcon: function (liked) {
                    return liked ? this.icons.FILLED : this.icons.NORMAL;
                },
                likeEnter: function (buttonId, liked) {
                    let b = $('#' + buttonId);
                    if (liked) {
                        b.attr('src', this.icons.FILLED);
                    } else {
                        b.attr('src', this.icons.OVER);
                    }


                },
                likeLeave: function (buttonId, liked) {
                    let b = $('#' + buttonId);
                    if (liked) {
                        b.attr('src', this.icons.FILLED);
                    } else {
                        b.attr('src', this.icons.NORMAL);
                    }
                },
                onLoadUser: function (author) {
                    closeModalArticle();
                    onLoadUser(author);
                },
                followButtonEnter: followButtonEnter,
                followButtonLeave: followButtonLeave,
                performFollow: performFollow,
                prepareArticleEdition: prepareArticleEdition,
                blockContent: blockContent

            }
        })
    } else {
        articleVue.$data.article = preparedArticle;
        articleVue.$data.userAddress = userAddress;
        articleVue.$data.license = license;
        articleVue.$data.featuredImage = getDefaultImageAndColor(preparedArticle.content_type, preparedArticle.featured_image);
    }

    trantor.dbrunner.getComments(mediaAddress, function (err, comments) {
        if (err) {
            console.error(err);
        } else {
            articleVue.$data.comments = comments;
        }
    });

    trantor.getUserData(userAddress, userAddress, function (err, data) {
        data = data[0];
        let avatarFile = data ? data.avatarFile : null;
        articleVue.$data.userAvatar = resolveAvatar(avatarFile, userAddress);
    });

    let tags = '';
    if (preparedArticle.tags && preparedArticle.tags.length > 0) {
        tags = linkTags(JSON.parse(preparedArticle.tags));
    }

    $('#article-tags').html(tags);

    $('#article-comment').val('');

    let licenseList = $('#article-license-list');
    licenseList.html('');

    $('#article-license').html('<a href="" onclick="return openUrlInBrowser(\'' + license.link + '\')">' + license.name + '</a>');
    license.icons.forEach(function (i) {
        let iconHtml = '<li><img src="' + i + '" alt=""></li>';
        licenseList.append(iconHtml);
    });


    //payingArticle = null;
}

function prepareArticle(mediaAddress, userAddress) {
    console.log('preparing article', mediaAddress, userAddress);
    trantor.dbrunner.getMediaByAddress(mediaAddress, userAddress, function (err, result) {
        if (err) {
            console.error(err);
        } else if (result.length > 0) {
            loadArticle(result, userAddress);
        }

    });
}

function publishComment(contentAddress) {
    console.log('Preparing to comment');
    let comment = removeHtml($('#article-comment').val());
    if (comment && comment.length > 0) {
        console.log('Commenting', comment);
        getUserAddress(function (userAddress) {
            trantor.comment(userAddress, contentAddress, comment);

        });
    } else {
        //TODO: SHOW Empty comment error
    }
}

function makeLike(address, userLiked) {

    if (!userLiked) {
        console.log('making like');
        let appStorage = FileStorage.load(CONSTANTS.APP_CONF_FILE);
        let likeAmount = Coin.parseCash(appStorage.getKey('action-amount'), 'CREA').amount;
        getUserAddress(function (userAddress) {
            trantor.like(userAddress, address, likeAmount);

        });
    } else {
        console.log('User has like in this content');
    }
}

function downloadPrivateContent(content, paymentId, isAuthor = false) {
    if (content.creation_date < CONSTANTS.ENC_TIME) {
        downloadPrivateFile(content.address, content.private_content)
    } else {
        unlockW(walletPassword, function (err, result) {
            if (err) {
                handleRpcError(err);
            } else {
                console.log(content, paymentId);

                if (isAuthor) {
                    decryptContent(content.address, paymentId, null, function (decryptedContent) {
                        downloadPrivateFile(content.address, decryptedContent);
                    });
                } else {
                    trantor.rpcWallet.getRawTransaction(paymentId, function (err, rawTx) {
                        if (err) {
                            handleRpcError(err);
                        } else {
                            decryptContent(content.address, paymentId, rawTx, function (decryptedContent) {
                                downloadPrivateFile(content.address, decryptedContent);
                            })
                        }
                    });
                }
            }

        });
    }
}

function downloadPrivateFile(contentAddress, privateContent) {
    console.log('Downloading', contentAddress, privateContent);
    trantor.dbrunner.setMediaPrivateContent(contentAddress, privateContent);

    trantor.ipfsrunner.downloadFile(contentAddress, privateContent, true, function (data, file, contentAddress) {
        let tHash = Utils.makeHash(data.CID);

        trantor.dbrunner.putTorrent(tHash, data.CID, data.path, file);
        trantor.emit('core.file.downloaded', contentAddress, data);
    });
    pendingContent[contentAddress] = { pending: true };
}

function mustBeDownloadContent() {
    let privateTorrent = preparedArticle.private_content;
    let privateFile = preparedArticle.private_file;

    if (privateFile && privateFile.length > 0) {
        return false;
    } else if (privateTorrent && privateTorrent.length > 0) {
        return true;
    }

    return false;
}

function makePayment() {
    let privateTorrent = preparedArticle.private_content;
    let privateFile = preparedArticle.private_file;

    if (mustBeDownloadContent()) {
        payingArticle = preparedArticle;
        pendingDownloads[preparedArticle.address] = preparedArticle;
        getUserAddress(function (userAddress) {

            if (userAddress === preparedArticle.author) {
                downloadPrivateContent(preparedArticle, userAddress, true);
            } else {
                trantor.dbrunner.getPayment(userAddress, preparedArticle.address, function (err, result) {
                    if (err) {
                        console.error(err);
                    } else {
                        if (result[0]) {
                            downloadPrivateContent(preparedArticle, result[0].txid);
                            trantor.emit('core.notification', lang.Files, lang.DownloadFileStart, './assets/img/wallet/icon-receive.png', 5);
                        } else {
                            if (preparedArticle.price > 0) {
                                closeModalArticle();
                                unlockW(walletPassword, function (err, result) {
                                    if (err) {
                                        handleRpcError(err);
                                    } else {
                                        trantor.payment(userAddress, preparedArticle.address);
                                    }
                                });

                            } else {
                                //Private file is free, No Encrypted
                                downloadPrivateFile(preparedArticle.address, privateTorrent);
                                trantor.emit('core.notification', lang.Files, lang.DownloadFileStart, './assets/img/wallet/icon-receive.png', 5);
                            }
                        }
                    }
                });
            }


        });

    } else if (File.exist(privateFile)) {
        let name = File.getName(privateFile);
        let title = String.format(lang.SaveFile, name);
        dialog.showSaveDialog(null, {
            title: title,
            defaultPath: name
        }, function (fileName) {
            if (fileName) {
                trantor.emit('core.notification', lang.Files, lang.CopyingFile, './assets/img/wallet/icon-receive.png', 5);
                File.cp(privateFile, fileName);
                let notifBody = String.format(lang.FileCopied, fileName);
                trantor.emit('core.notification', lang.Files, notifBody, './assets/img/wallet/icon-receive.png', 10);
            }
        })
    }
}

function followUser(followedAddress) {
    console.log('follow', followedAddress);
    getUserAddress(function (userAddress) {
        if (followedAddress !== userAddress) {
            unlockW(walletPassword, function (err, result) {
                if (err) {
                    handleRpcError(err);
                } else {
                    trantor.follow(userAddress, followedAddress);
                }
            });

        }

    })
}

function unFollowUser(followedAddress) {
    console.log('Unfollow', followedAddress);
    getUserAddress(function (userAddress) {
        unlockW(walletPassword, function (err, result) {
            if (err) {
                handleRpcError(err);
            } else {
                trantor.unfollow(userAddress, followedAddress);
            }
        });
    })
}

function prepareArticleEdition() {
    let editArticleAddress = preparedArticle;

    $('#modal-article').modal('hide');

    setTimeout(function () {
        editArticle(editArticleAddress);
    }, 400);
}
