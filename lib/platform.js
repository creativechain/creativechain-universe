
let followedList = $('#following-list');
let followedLoader = $('#follows-items');

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

let PAGES = {
    DISCOVER: 0,
    FOLLOWING: 1
};

let page = PAGES.DISCOVER;

let mediaControl = null;
trantor.events.on('onStart', function () {
    console.log('onStart');
    modal.hide(false);
    init();
});

trantor.events.on('onExploreProgress', function (total, current) {
    console.log(total, current, (current * 100 / total) + '%')
});

trantor.events.on('onExploreFinish', function (blockCount, blockHeight) {
    console.log('Trantor exploration process finished', blockCount, blockHeight);
    $('#blockchain-sync').addClass('hidden');

    //loadUserFollowedItems();
    loadAllMedia();
    //reloadNotifications();

    alertUpdate();
});

trantor.events.on('onDataFound', function (tx, data, blockTime) {
    console.log('Data found', data);

    switch (data.type) {
        case PUBLICATION.TYPE.USER:
            trantor.database.addAuthor(data, tx, blockTime, function () {
                setTimeout(function () {
                    updateAuthor(data.address);
                    mustReloadFollowers = true;
                    loadUserFollowedItems();
                }, 200);
            });

            downloadAuthorAvatar(data.address, data.avatar);

            break;
        case PUBLICATION.TYPE.CONTENT:
            getUserAddress(function (userAddress) {
                trantor.database.getFollowingData(userAddress, data.author, PUBLICATION.TYPE.BLOCK, function (err, result) {
                    if (err) {
                        console.error(err);
                    } else if (result.length <= 0) {
                        //User is not blocked
                        if (data.publicContent && data.publicContent.length > 0) {
                            fileClient.downloadFile(data.contentAddress, data.publicContent, function (torrent, file, contentAddress) {
                                let tHash = Utils.makeHash(torrent.magnetURI);
                                trantor.database.putTorrent(tHash, torrent.magnetURI, torrent.path, file);
                                trantor.events.emit('onTorrentDownloaded', contentAddress, torrent);

                                updateMediaItemView(data.contentAddress, userAddress);
                            });
                        }
                        trantor.insertMedia(data, tx, blockTime, function (err, result) {
                            if (err) {
                                console.error(err)
                            } else {
                                mustReloadContent = true;
                                setTimeout(function () {
                                    updateMediaItemView(data.contentAddress, userAddress);
                                    updateAuthor(data.userAddress);

                                    if (data.userAddress === Constants.UPDATE_USER) {
                                        console.log('New update!', data.title);
                                        if (checkUpdate(data.contentAddress, data.title)) {
                                            trantor.database.insertNotification(data.userAddress, data.type, data.contentAddress, blockTime);
                                            loadAllNotifications();
                                        }

                                    }

                                }, 500);
                            }
                        });
                    }
                })

            });
            break;
        case PUBLICATION.TYPE.COMMENT:
            getUserAddress(function (userAddress) {
                trantor.insertComment(data, tx, blockTime, function () {
                    setTimeout(function () {
                        updateMediaItemView(data.contentAddress, userAddress);
                        updateAuthor(data.author);
                    }, 200);

                });

                trantor.database.getMediaByAddress(data.contentAddress, userAddress, function (err, result) {
                    if (err) {
                        console.error(err);
                    } else if (result.length > 0) {
                        let media = result[0];
                        if (media.author === userAddress) {
                            trantor.database.insertNotification(data.author, data.type, data.contentAddress, blockTime)
                            loadAllNotifications();
                        }
                    }
                });

            });

            break;
        case PUBLICATION.TYPE.LIKE:

            getUserAddress(function (userAddress) {
                trantor.database.addLike(data, tx, function () {
                    setTimeout(function () {
                        updateMediaItemView(data.contentAddress, userAddress);
                        updateAuthor(data.author);
                    }, 200);
                });

                trantor.database.getMediaByAddress(data.contentAddress, userAddress, function (err, result) {
                    if (err) {
                        console.error(err);
                    } else if (result.length > 0) {
                        let media = result[0];
                        if (media.author === userAddress) {
                            trantor.database.insertNotification(data.author, data.type, data.contentAddress, blockTime);
                            loadAllNotifications();
                        }
                    }
                });

            });

            break;
        case PUBLICATION.TYPE.UNLIKE:
            getUserAddress(function (userAddress) {
                trantor.database.addUnlike(data, tx, function () {
                    //TODO: SHOW UNLIKES ?
                });
            });
            break;
        case PUBLICATION.TYPE.PAYMENT:
            getUserAddress(function (userAddress) {
                trantor.database.addPayment(data, tx, function () {
                    setTimeout(function () {
                        updateMediaItemView(data.contentAddress, userAddress);
                        updateAuthor(data.author);
                    }, 200);
                });

                trantor.database.getMediaByAddress(data.contentAddress, userAddress, function (err, result) {
                    if (err) {
                        console.error(err);
                    } else if (result.length > 0) {
                        console.log(result);
                        result = result[0];

                        if (userAddress === data.author) {
                            downloadPrivateContent(result, tx.hash);
                        }

                        if (userAddress === result.author) {
                            console.log('Payment received!');
                            trantor.database.insertNotification(data.author, data.type, data.contentAddress, blockTime);
                            loadAllNotifications();
                        }
                    }
                });

            });
            break;
        case PUBLICATION.TYPE.FOLLOW:
        case PUBLICATION.TYPE.UNFOLLOW:
        case PUBLICATION.TYPE.BLOCK:
            getUserAddress(function (userAddress) {
                trantor.database.addFollowing(data, tx, blockTime, function (err) {
                    if (err) {
                        console.error(err)
                    } else {
                        if (data.type === PUBLICATION.TYPE.UNFOLLOW) {
                            trantor.database.removeFollowing(data);
                        } else if (data.type === PUBLICATION.TYPE.BLOCK && data.followerAddress === userAddress) {
                            let deleteUser = 0;
                            let deleteMedia = 1;
                            let onDelete = function (deletion) {
                                if (deletion === deleteMedia) {
                                    trantor.database.removeMedia(data.followedAddress);
                                } else if (deletion === deleteUser) {
                                    trantor.database.removeMediaByAuthor(data.followedAddress);
                                }
                            };

                            trantor.database.getMediaByAddress(data.followedAddress, 'a', function (err, result) {
                                if (err) {
                                    console.error(err)
                                } else if (result.length > 0) {
                                    onDelete(deleteMedia);
                                }
                            });

                            trantor.database.getAuthor(data.followedAddress, userAddress, function(err, result) {
                                if (err) {
                                    console.error(err)
                                } else if (result.length > 0) {
                                    onDelete(deleteUser);
                                }
                            })
                        }
                    }

                    loadUserFollowedItems();
                    updateAuthor(data.followedAddress);
                });

                if (data.type === PUBLICATION.TYPE.FOLLOW) {
                    if (data.followedAddress === userAddress) {
                        trantor.database.insertNotification(data.followerAddress, data.type, data.followedAddress, blockTime);
                        setTimeout(function () {
                            trantor.database.getFollowingData(userAddress, data.followedAddress, PUBLICATION.TYPE.FOLLOW, function (err, result) {
                                if (err) {
                                    console.error(err)
                                } else if (result.length > 0) {
                                    let data = result[0];
                                    //loadUserFollowed(data);
                                }
                            });

                        }, 200);
                    }
                }
            });
    }
});

trantor.events.on('onBeforeComment', function (txBuffer, comment) {

    sendTransaction(txBuffer.toString('hex'), walletPassword, function (err, result) {
        if (err) {
            console.log(err);
        } else {
            Notifications.notify(lang.CommentPublished, lang.CommentPublishedSuccessfully, './assets/img/publications1.png', 5);
            let tx = DecodedTransaction.fromHex(txBuffer.toString('hex'));
            trantor.events.emit('onAfterComment', tx, comment);
        }
    })
});

trantor.events.on('onAfterComment', function (tx, comment) {
    trantor.insertComment(comment, tx, new Date().getTime(), function (err) {
        if (err) {
            console.error(err);
        } else {
            console.log('Comment inserted!');
            $('#article-comment').val('');
            setTimeout(function () {
                getUserAddress(function (userAddress) {
                    updateMediaItemView(comment.contentAddress, userAddress);
                    updateAuthor(comment.author);
                });
            }, 200);

        }
    });

    mustReloadContent = true;
});

trantor.events.on('onAfterPublish', function (tx, media) {
    trantor.insertMedia(media, tx, new Date().getTime(), function (err) {
        if (err) {
            console.error(err);
            modal.error({
                message: err
            })
        } else {
            setTimeout(function () {
                getUserAddress(function (userAddress) {
                    updateMediaItemView(media.contentAddress, userAddress);
                    updateAuthor(media.author);
                });
            }, 200);

        }
    });

    mustReloadContent = true;
});

trantor.events.on('onBeforeLike', function (txBuffer, like) {

    console.log('OnBeforeLike', txBuffer, like);
    sendTransaction(txBuffer.toString('hex'), walletPassword, function (err, result) {
        if (err) {
            console.log(err);
        } else {
            console.log('Like sended', result);
            let tx = DecodedTransaction.fromHex(txBuffer.toString('hex'));
            trantor.events.emit('onAfterLike', tx, like);
        }
    });
});

trantor.events.on('onAfterLike', function (tx, like) {

    trantor.database.addLike(like, tx, function (err) {
        if (err) {
            console.error(err);
        } else {
            setTimeout(function () {
                getUserAddress(function (userAddress) {
                    updateMediaItemView(like.contentAddress, userAddress);
                    updateAuthor(like.author);
                });
            }, 200);

        }
    });
});

/**
 *
 * @param {TransactionBuilder} txBuilder
 * @param {Array} spendables
 */
trantor.events.on('onBeforeTransactionSend', function (txBuilder, creaBuilder) {
    let totalOut = txBuilder.getTotalOutput();

    let fee = Coin.parseCash(txBuilder.txFee, 'CREA');
    totalOut = Coin.parseCash(totalOut, 'CREA');

    let total = fee.amount + totalOut.amount;
    total = Coin.parseCash(total, 'CREA');

    console.log(txBuilder, creaBuilder, totalOut, fee, total);
    let txMessage = String.format(lang.TxSendMessage, totalOut.toFriendlyString(), fee.toFriendlyString(), total.toFriendlyString());
    modal.alert({
        message: txMessage,
        ok: {
            text: lang.Send,
            onclick: function () {
                modal.hide(true);
                setTimeout(function () {
                    unlockW(walletPassword, function (err, result) {
                        if (err) {
                            handleRpcError(err)
                        } else {
                            trantor.signTransaction(creaBuilder, txBuilder.inputs, function (err, txHex) {
                                if (err) {
                                    modal.error({
                                        message: err.message
                                    })
                                } else {
                                    trantor.sendRawTransaction(txHex, function (err, result) {
                                        if (err) {
                                            console.error(err);
                                            modal.error({
                                                message: err.message
                                            })
                                        } else {
                                            refreshWallet();
                                            //console.log(result);
                                            modal.alert({
                                                message: lang.TransactionSend + '\n' + result
                                            });

                                            clearSendFields();
                                            trantor.events.emit('onAfterTransactionSend', result);
                                        }
                                    })
                                }

                            })
                        }
                    });

                }, 500);

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
trantor.events.on('onAfterTransactionSend',function (tx) {
    Notifications.notify(lang['TransactionSend'], tx.hash, './assets/img/notification/wallet.png', 2);
});

trantor.events.on('onAvatarDownloaded', function (authorAddress, torrent) {

    setTimeout(function () {
        updateAuthor(authorAddress);
        mustReloadFollowers = true;
        loadProfileFollows();
    }, 200);

});

trantor.events.on('onTorrentDownloaded', function (contentAddress, torrent) {

    getUserAddress(function (userAddress) {
        updateMediaItemView(contentAddress, userAddress, false);
        updatePreparedArticle(contentAddress, userAddress);

        if (pendingContent[contentAddress] && pendingContent[contentAddress].pending) {
            trantor.database.getMediaByAddress(contentAddress, userAddress, function (err, result) {
                if (err) {
                    console.error(err);
                } else if (result.length > 0) {
                    result = result[0];
                    let body = String.format(lang.DownloadFinishedBody, result.title);
                    Notifications.notify(lang.DownloadFinished, body, './assets/img/notifications.png', 10);
                    delete pendingDownloads[contentAddress];

                }
            });
        }
    });


});

trantor.events.on('onBeforePayment', function (tx, txBuffer, payment, txBuilder) {
    let dTx = DecodedTransaction.fromHex(txBuffer.toString('hex'));
    let fee = Coin.parseCash(txBuilder.txFee, 'CREA');
    let totalOutAmount = Coin.parseCash(txBuilder.getTotalOutput(), 'CREA');
    let totalAmount = Coin.parseCash(totalOutAmount.amount + fee.amount, 'CREA');
    console.log(dTx, txBuilder, tx);

    let paymentBody = String.format(lang.PaymentBody, totalOutAmount.toFriendlyString(), fee.toFriendlyString(), totalAmount.toFriendlyString());
    modal.alert({
        message: paymentBody,
        ok: {
            onclick: function () {
                sendTransaction(txBuffer.toString('hex'), walletPassword, function (err, txid) {
                    if (err) {
                        console.error(err);
                        modal.error({
                            message: err.message
                        });
                    } else {
                        console.log(txid);
                        trantor.database.addPayment(payment, dTx, function (err, result) {
                            if (err) {
                                console.error(err);
                            } else {
                                Notifications.notify(lang.Payment, lang.PaymentSent, './assets/img/notification/wallet.png', 10);
                                getUserAddress(function (userAddress) {

                                    if (payingArticle) {
                                        prepareArticle(payingArticle.address, userAddress);
                                        showModalArticle();
                                    }

                                    trantor.database.getMediaByAddress(payment.contentAddress, userAddress, function (err, medias) {
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
                })
            }
        },
        cancel: {
            text: lang.Cancel,
            onclick: function () {
                if (payingArticle) {
                    getUserAddress(function (userAddress) {
                        prepareArticle(payingArticle.address, userAddress);
                        showModalArticle();
                    });

                }
            }
        }
    });

});

trantor.events.on('onFollow', function (creaBuilder, txBuffer, data, txBuilder) {
    let dTx = DecodedTransaction.fromHex(txBuffer.toString('hex'));
    sendTransaction(txBuffer.toString('hex'), walletPassword, function (err, result) {
        if (err) {
            handleRpcError(err);
        } else {
            console.log('Follow performed!');
            trantor.database.addFollowing(data, dTx, new Date().getTime(), function () {
                setTimeout(function () {

                    updateAuthor(data.followedAddress);
                    trantor.database.getMediaByAuthor(data.followedAddress, data.followerAddress, function (err, result) {
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
                }, 200);
            });
        }
    })
});

trantor.events.on('onBeforeBlockContent', function (creaBuilder, txBuffer, data, txBuilder) {
    let onBlock = function () {
        let dTx = DecodedTransaction.fromHex(txBuffer.toString('hex'));
        sendTransaction(txBuffer.toString('hex'), walletPassword, function (err, result) {
            if (err) {
                console.error(err);
            } else {
                let deleteUser = 0;
                let deleteMedia = 1;
                let onDelete = function (deletion) {
                    if (deletion === deleteMedia) {
                        trantor.database.removeMedia(data.followedAddress);
                    } else if (deletion === deleteUser) {
                        trantor.database.removeMediaByAuthor(data.followedAddress);
                    }

                    $('#modal-article').modal('hide');
                    mustReloadContent = true;
                    loadAllMedia();
                    loadAllUserMedia(loadedProfile);
                };

                trantor.database.getMediaByAddress(data.followedAddress, 'a', function (err, result) {
                    if (err) {
                        console.error(err)
                    } else if (result.length > 0) {
                        onDelete(deleteMedia);
                    }
                });

                getUserAddress(function (userAddress) {
                    trantor.database.getAuthor(data.followedAddress, userAddress, function(err, result) {
                        if (err) {
                            console.error(err)
                        } else if (result.length > 0) {
                            onDelete(deleteUser);
                        }
                    })
                });
            }
        })
    };

    closeModalArticle();

    modal.alert({
        title: lang.ContentBlocking,
        message: lang.ContentBlockingMessage,
        ok : {
            onclick: function () {
                onBlock();
            }
        },
        cancel: {
            onclick: function () {
                modal.hide(true);
                //showModalArticle();
            }
        }

    })

});

trantor.events.on('onUnfollow', function (creaBuilder, txBuffer, data, txBuilder) {
    let dTx = DecodedTransaction.fromHex(txBuffer.toString('hex'));
    sendTransaction(txBuffer.toString('hex'), walletPassword, function (err, result) {
        if (err) {
            handleRpcError(err)
        } else {
            trantor.database.addFollowing(data, dTx, new Date().getTime(), function () {
                trantor.database.removeFollowing(data);
                setTimeout(function () {

                    updateAuthor(data.followedAddress);
                    trantor.database.getMediaByAuthor(data.followedAddress, data.followerAddress, function (err, result) {
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
                }, 400);
            });
        }
    })
});

trantor.events.on('onLog', function () {
    console.log.apply(console, arguments);
});

trantor.events.on('onWindowsNotification', function (text, duration) {
   let winNotif = $('#win-notification');
   let winNotifText = $('#win-notification-text');
   let winNotifClose = $('#win-notification-close');

   let closeNotif = function () {
       winNotif.addClass('hidden');
   };

   winNotifText.html(text);
   winNotifClose.unbind('click')
       .click(function () {
           closeNotif();
       });

   if (duration) {
        setTimeout(function () {
            closeNotif();
        }, duration)
   }

   winNotif.removeClass('hidden');
});

trantor.events.on('onLoadingResources', function () {
    modal.loading(lang.LoadingResources);
});

trantor.events.on('onError', function () {
    let error = arguments[0][0];

    let errorMessage = null;

    if (error) {
        switch (error) {
            case ErrorCodes.NOT_SPENDABLES:
                errorMessage = lang.WalletPendingEntries;
                break;
            case ErrorCodes.INSUFFICIENT_AMOUNT:
                errorMessage = lang.InsuficientAmount;
                break;
        }

        if (errorMessage) {
            modal.hide();
            modal.error({
                message: errorMessage,
            })
        }
    }
    console.error.apply(console, arguments);
});

/*$('#modal-article').bind('onClassChanged', function () {
    console.log('onClassChanged');
    let isShowing = $('#modal-article').hasClass('in');

    if (mediaControl && !isShowing) {
        mediaControl.pause();
    }
});*/

function init() {
    mustReloadFollowers = true;
    mustReloadContent = true;
    mustReloadNotifications = true;

    loadAllMedia();
    loadUserFollowedItems();
    loadAbout();
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
    let version = pjson.version + ' ' + lang.VersionName;
    let osname = (OS.getPlatform() + ' ' + OS.getRelease() + ' ' + OS.getArch()).capitalize();

    $('#about-version').html(version.capitalize());
    $('#about-system').html(osname);
}

function updateAuthor(authorAddress) {
    getUserAddress(function (userAddress) {
        //Update profile if this is showing;
        updateAuthorProfile(authorAddress);

        //Update all author publications
        trantor.database.getMediaAddressByAuthor(authorAddress, function (err, mediaAddresses) {
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
    trantor.database.getMediaByAddress(address, userAddress, function (err, result) {
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

            articleVueList.$forceUpdate();
        }
    });

}

function showSearch(result, userAddress) {
    articleVueList.$data.publications = result;
    articleVueList.$data.userAddress = userAddress;
}

function downloadAuthorAvatar(authorAddress, avatarMagnet) {
    fileClient.downloadFile(authorAddress, avatarMagnet, function (torrent, file, address) {
        //console.log('author torrent', avatarMagnet);
        let tHash = Utils.makeHash(avatarMagnet);
        trantor.database.putTorrent(tHash, avatarMagnet, torrent.path, file);
        trantor.events.emit('onAvatarDownloaded', authorAddress, torrent);

        setTimeout(function () {
            getUserAddress(function (userAddress) {
                trantor.database.getMediaByAuthor(authorAddress, userAddress, function (err, result) {
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
        },  200)
    })
}

/**
 *
 * @param {string} contentAddress
 * @param {string} magnet
 */
function downloadPublicFile(contentAddress, magnet) {
    if (magnet && magnet.length > 0) {
        //console.log('Adding torrent', magnet);
        fileClient.downloadFile(contentAddress, magnet, function (torrent, file, contentAddress) {
            let tHash = Utils.makeHash(torrent.magnetURI);
            trantor.database.putTorrent(tHash, magnet, torrent.path, file);
            //trantor.events.emit('onTorrentDownloaded', 100, contentAddress, torrent);
            setTimeout(function () {
                getUserAddress(function (userAddress) {
                    updateMediaItem(contentAddress, userAddress);
                    updateProfileMediaItem(contentAddress, userAddress);
                });
            }, 200);

        });
    }

}

function performFollow(address) {
    getUserAddress(function (userAddress) {
        if (address !== userAddress) {
            trantor.database.getFollowingData(userAddress, address, PUBLICATION.TYPE.FOLLOW, function (err, result) {
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
                getBuzz: function(user_likes, user_comments, publications, followers, actions = 0) {
                    return BUZZ.getBuzz(user_likes, user_comments, publications, followers, actions)
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
                    let icons = {
                        NORMAL: './assets/img/like0.png',
                        FILLED: './assets/img/like2.png',
                        OVER: './assets/img/like-border.png',
                    };
                    let b = $('#' + buttonId);
                    if (liked) {
                        b.attr('src', icons.FILLED);
                    } else {
                        b.attr('src', icons.OVER);
                    }


                },
                likeLeave: function (buttonId, liked) {
                    let icons = {
                        NORMAL: './assets/img/like0.png',
                        FILLED: './assets/img/like2.png',
                        OVER: './assets/img/like-border.png',
                    };
                    let b = $('#' + buttonId);
                    if (liked) {
                        b.attr('src', icons.FILLED);
                    } else {
                        b.attr('src', icons.NORMAL);
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

function loadAllMedia() {
    if (!onSearch) {
        if (mustReloadContent) {
            getUserAddress(function (userAddress) {
                trantor.database.getAllMedia(userAddress, discoverPage, function (err, result) {
                    if (err) {
                        console.error(err);
                    } else {
                        showMediaResults(result, userAddress);
                    }
                });

                mustReloadContent = false;
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
    }
}

function loadMoreDiscoverMedia() {
    discoverPage++;
    getUserAddress(function (userAddress) {
        trantor.database.getAllMedia(userAddress, discoverPage, function (err, results) {
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
        trantor.database.getMediaByFollowerAddress(userAddress, userAddress, followingMediaPage, function (err, results) {

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
    getUserAddress(function (userAddress) {
        trantor.database.getMediaByFollowerAddress(userAddress, userAddress, followingMediaPage, function (err, result) {
            if (err) {
                console.error(err);
            } else {
                showMediaResults(result, userAddress);
            }
        });

    });

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

function loadUserFollowedItems() {
    if (mustReloadFollowers) {
        loadProfileFollows();
        mustReloadFollowers = false;

        getUserAddress(function (userAddress) {
            trantor.database.getFollowing(userAddress, userAddress, function (err, result) {

                if (err) {
                    console.error(err);
                } else {
                    if (!followingVueList) {
                        followingVueList = new Vue({
                            el: '#following-list',
                            data: {
                                follows: result,
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
        trantor.database.getFollowingData(userAddress, followedAddress, PUBLICATION.TYPE.FOLLOW, function (err, result) {

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

function prepareArticle(mediaAddress, userAddress) {
    console.log('preparing article', mediaAddress, userAddress);
    trantor.database.getMediaByAddress(mediaAddress, userAddress, function (err, result) {
        console.log(result);
        preparedArticle = result[0];

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
                methods: {
                    resolveAvatar: resolveAvatar,
                    getBuzz: function () {
                        return BUZZ.getBuzz(this.article.user_likes, this.article.user_comments, this.article.publications, this.article.user_followers, 0, 'prepareArticleGetBuzz');
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
                    openUrlInBrowser: openUrlInBrowser,
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
            articleVue.$data.license = license;
            articleVue.$data.featuredImage = getDefaultImageAndColor(preparedArticle.content_type, preparedArticle.featured_image);
        }

        trantor.database.getComments(mediaAddress, function (err, comments) {
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

        makeLikeButton('article-like', preparedArticle.user_liked, preparedArticle.address);

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


    });
}

function publishComment(contentAddress) {
    console.log('Preparing to comment');
    let comment = removeHtml($('#article-comment').val());
    if (comment && comment.length > 0) {
        console.log('Commenting', comment);
        getUserAddress(function (userAddress) {
            unlockW(walletPassword, function (err, result) {
                if (err) {
                    handleRpcError(err);
                } else {
                    trantor.makeComment(userAddress, contentAddress, comment);
                }

            });

        });
    } else {
        //TODO: SHOW Empty comment error
    }
}

function makeLike(address, userLiked) {

    if (!userLiked) {
        console.log('making like');
        let appStorage = FileStorage.load();
        let likeAmount = Coin.parseCash(appStorage.getKey('action-amount'), 'CREA').amount;
        getUserAddress(function (userAddress) {
            unlockW(walletPassword, function (err, result) {
                if (err) {
                    handleRpcError(err);
                } else {
                    trantor.makeLike(userAddress, address, likeAmount);
                }
            });

        });
    } else {
        console.log('User has like in this content');
    }
}

function downloadPrivateContent(content, paymentId) {
    if (content.creation_date < Constants.ENC_TIME) {
        downloadPrivateFile(content.address, content.private_content)
    } else {
        unlockW(walletPassword, function (err, result) {
            if (err) {
                handleRpcError(err);
            } else {
                console.log(content, paymentId);
                trantor.client.getRawTransaction(paymentId, function (err, rawTx) {
                    if (err) {
                        handleRpcError(err);
                    } else {
                        decryptContent(content.address, paymentId, rawTx, function (decryptedContent) {
                            downloadPrivateFile(content.address, decryptedContent);
                        })
                    }
                });

            }

        });
    }
}

function downloadPrivateFile(contentAddress, privateContent) {
    console.log('Downloading', contentAddress, privateContent);
    trantor.database.setMediaPrivateContent(contentAddress, privateContent);

    fileClient.downloadFile(contentAddress, privateContent, function (torrent, file, contentAddress) {
        let tHash = Utils.makeHash(torrent.magnetURI);

        trantor.database.putTorrent(tHash, torrent.magnetURI, torrent.path, file);
        trantor.events.emit('onTorrentDownloaded', contentAddress, torrent);
    }, true);
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
        closeModalArticle();
        pendingDownloads[preparedArticle.address] = preparedArticle;
        getUserAddress(function (userAddress) {
            trantor.database.getPayment(userAddress, preparedArticle.address, function (err, result) {
                if (err) {
                    console.error(err);
                } else {
                    if (result[0]) {
                        downloadPrivateContent(preparedArticle, result[0].txid);
                        Notifications.notify(lang.Files, lang.DownloadFileStart, './assets/img/wallet/icon-receive.png', 5);
                    } else {
                        if (preparedArticle.price > 0) {
                            unlockW(walletPassword, function (err, result) {
                                if (err) {
                                    handleRpcError(err);
                                } else {
                                    trantor.makeContentPayment(userAddress, preparedArticle.address);
                                }
                            });

                        } else {
                            //Private file is free, No Encrypted
                            downloadPrivateFile(preparedArticle.address, privateTorrent);
                            Notifications.notify(lang.Files, lang.DownloadFileStart, './assets/img/wallet/icon-receive.png', 5);
                        }
                    }
                }
            });
        });

    } else if (File.exist(privateFile)) {
        let name = File.getName(privateFile);
        let title = String.format(lang.SaveFile, name);
        dialog.showSaveDialog(null, {
            title: title,
            defaultPath: name
        }, function (fileName) {
            if (fileName) {
                Notifications.notify(lang.Files, lang.CopyingFile, './assets/img/wallet/icon-receive.png', 5);
                setTimeout(function () {
                    File.cp(privateFile, fileName);
                    let notifBody = String.format(lang.FileCopied, fileName);
                    Notifications.notify(lang.Files, notifBody, './assets/img/wallet/icon-receive.png', 10);
                }, 10)
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
                    trantor.makeFollow(userAddress, followedAddress);
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
                trantor.makeUnfollow(userAddress, followedAddress);
            }
        });
    })
}

function prepareArticleEdition() {
    $('#modal-article').modal('hide');

    setTimeout(function () {
        editArticle(preparedArticle);
    }, 400);
}
