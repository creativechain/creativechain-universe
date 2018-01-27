
let articleList = $('#ui-posts');
let followedList = $('#following-list');
let articleLoader = $('#publication-items');
let followedLoader = $('#follows-items');

let preparedArticle;
let onSearch = false;
let mustReloadContent = true;
let mustReloadFollowers = true;
let mustReloadNotifications = true;
let paymentAddresses = {};
let pendingDownloads = {};
let discoverPage = 1;
let followingMediaPage = 1;

let PAGES = {
    DISCOVER: 0,
    FOLLOWING: 1
};

let page = PAGES.DISCOVER;

let mediaControl = null;
trantor.events.subscribe('onStart', 'main', function () {
    console.log('onStart');
    init();
});

trantor.events.subscribe('onExploreProgress', 'main', function (args) {
    let total = args[0];
    let current = parseInt(args[1]);
    console.log(total, current, (current * 100 / total) + '%')
});

trantor.events.subscribe('onExploreFinish', 'main', function (args) {
    let blockCount = args[0];
    let blockHeight = args[1];
    console.log('Trantor exploration process finished', blockCount, blockHeight);
    $('#blockchain-sync').addClass('hidden');

    loadUserFollowedItems();
    loadAllMedia();
    reloadNotifications();
});

trantor.events.subscribe('onDataFound', 'main', function (args) {
    let tx = args[0];
    let data = args[1];
    let blockTime = args[2];

    console.log('Data found', data);

    switch (data.type) {
        case PUBLICATION.TYPE.USER:
            torrentClient.downloadTorrent(data.address, data.avatar, function (torrent, file, contentAddress) {
                let tHash = Utils.makeHash(data.avatar);
                trantor.database.putTorrent(tHash, data.avatar, torrent.path, file);
                trantor.events.notify('onTorrentDownloaded', 100, contentAddress, torrent);
            });
            trantor.database.addAuthor(data, tx, blockTime, function () {
                //refreshUserData();
            });
            break;
        case PUBLICATION.TYPE.CONTENT:
            getUserAddress(function (userAddress) {
                trantor.database.getFollowingData(userAddress, data.author, PUBLICATION.TYPE.BLOCK, function (err, result) {
                    if (err) {
                        console.error(err);
                    } else if (result.length <= 0) {
                        //User is not blocked
                        if (data.publicContent && data.publicContent.length > 0) {
                            torrentClient.downloadTorrent(data.contentAddress, data.publicContent, function (torrent, file, contentAddress) {
                                let tHash = Utils.makeHash(torrent.magnetURI);
                                trantor.database.putTorrent(tHash, torrent.magnetURI, torrent.path, file);
                                trantor.events.notify('onTorrentDownloaded', 100, contentAddress, torrent);
                            });
                        }
                        trantor.insertMedia(data, tx, blockTime, function (err, result) {
                            if (err) {
                                console.error(err)
                            } else {
                                setTimeout(function () {
                                    prependItem(data.contentAddress);
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
                    console.log('Comment added!');
                    if (preparedArticle && (preparedArticle.address === data.contentAddress)) {
                        prepareArticle(preparedArticle.address, userAddress);
                    }
                });

                trantor.database.getMediaByAddress(data.contentAddress, userAddress, function (err, result) {
                    if (err) {
                        console.error(err);
                    } else if (result.length > 0) {
                        let media = result[0];
                        if (media.author === userAddress) {
                            trantor.database.insertNotification(data.author, data.type, data.contentAddress, blockTime)
                        }
                    }
                });

            });

            break;
        case PUBLICATION.TYPE.LIKE:

            getUserAddress(function (userAddress) {
                trantor.database.addLike(data, tx, function () {
                    console.log('Like added!');
                    if (preparedArticle && (preparedArticle.address === data.contentAddress)) {
                        prepareArticle(preparedArticle.address, userAddress);
                    }
                });

                trantor.database.getMediaByAddress(data.contentAddress, userAddress, function (err, result) {
                    if (err) {
                        console.error(err);
                    } else if (result.length > 0) {
                        let media = result[0];
                        if (media.author === userAddress) {
                            trantor.database.insertNotification(data.author, data.type, data.contentAddress, blockTime)
                        }
                    }
                });

            });

            break;
        case PUBLICATION.TYPE.UNLIKE:
            getUserAddress(function (userAddress) {
                trantor.database.addUnlike(data, tx, function () {
                    console.log('Unlike added!');
                    if (preparedArticle && (preparedArticle.address === data.contentAddress)) {
                        prepareArticle(preparedArticle.address, userAddress);
                    }
                });
            });
            break;
        case PUBLICATION.TYPE.PAYMENT:
            getUserAddress(function (userAddress) {
                trantor.database.addPayment(data, tx, function () {
                    console.log('Payment added!');
                    if (preparedArticle && (preparedArticle.address === data.contentAddress)) {
                        prepareArticle(preparedArticle.address, userAddress);
                    }
                });

                trantor.database.getMediaByAddress(data.contentAddress, userAddress, function (err, result) {
                    if (err) {
                        console.error(err);
                    } else {
                        console.log(result);
                        result = result[0];
                        if (userAddress === data.author) {
                            downloadPrivateFile(data.contentAddress, result.private_file);
                            trantor.database.insertNotification(data.author, data.type, data.contentAddress, blockTime)
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
                            removeFollowed(data.followedAddress);
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
                                    loadUserFollowed(data);
                                }
                            });

                        }, 200);
                    }
                }
            });
    }

    setTimeout(function () {
        loadAllMedia();
        loadAllNotifications();
    }, 500);
});

trantor.events.subscribe('onBeforeComment', 'main', function (args) {
    let txBuffer = args[0];
    let comment = args[1];

    trantor.client.sendRawTransaction(txBuffer.toString('hex'), function (err, result) {
        if (err) {
            console.log(err);
        } else {
            Notifications.notify(lang.CommentPublished, lang.CommentPublishedSuccessfully, './assets/img/publications1.png', 5);
            let tx = DecodedTransaction.fromHex(txBuffer.toString('hex'));
            trantor.events.notify('onAfterComment', 10, tx, comment);
        }
    })
});

trantor.events.subscribe('onAfterComment', 'main', function (args) {
    let tx = args[0];
    let comment = args[1];
    trantor.insertComment(comment, tx, new Date().getTime(), function (err) {
        if (err) {
            console.error(err);
        } else {
            console.log('Comment inserted!');
            $('#article-comment').val('');
            if (preparedArticle && preparedArticle.address === comment.contentAddress) {
                loadComments(preparedArticle.address);
            }
        }
    });

    mustReloadContent = true;
});

trantor.events.subscribe('onAfterPublish', 'main', function (args) {
    let tx = args[0];
    let media = args[1];
    console.log(args);
    trantor.insertMedia(media, tx, new Date().getTime(), function (err) {
        if (err) {
            console.error(err);
            modal.error({
                message: err
            })
        } else {
            console.log('Media inserted!');
            setTimeout(function () {
                prependItem(media.contentAddress);
            }, 500);

        }
    });

    mustReloadContent = true;
});

trantor.events.subscribe('onBeforeLike', 'main', function (args) {
    let txBuffer = args[0];
    let like = args[1];

    console.log('OnBeforeLike', txBuffer, like);
    trantor.client.sendRawTransaction(txBuffer.toString('hex'), function (err, result) {
        if (err) {
            console.log(err);
        } else {
            console.log('Like sended', result);
            let tx = DecodedTransaction.fromHex(txBuffer.toString('hex'));
            trantor.events.notify('onAfterLike', 10, tx, like);
        }
    });
});

trantor.events.subscribe('onAfterLike', 'main', function (args) {
    let tx = args[0];
    let like = args[1];
    trantor.database.addLike(like, tx, function (err) {
        if (err) {
            console.error(err);
        } else {
            setTimeout(function () {
                updateItem(like.contentAddress, like.author);
                prepareArticle(like.contentAddress, like.author);
            }, 200);

        }
    });
});

/**
 *
 * @param {TransactionBuilder} txBuilder
 * @param {Array} spendables
 */
trantor.events.subscribe('onBeforeTransactionSend', 'index', function (args) {
    let txBuilder = args[0];
    let creaBuilder = args[1];

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
                                    trantor.events.notify('onAfterTransactionSend', 10, result);
                                }
                            })
                        }

                    })
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
trantor.events.subscribe('onAfterTransactionSend', 'main',function (args) {
    let tx = args[0];
    Notifications.notify(lang['TransactionSend'], tx.hash, './assets/img/notification/wallet.png', 2);
});

trantor.events.subscribe('onTorrentDownloaded', 'main', function (args) {
    //console.log('Torrent available', args);
    let address = args[0];
    let torrent = args[1];


    if (paymentAddresses[address] && paymentAddresses[address].pending) {
        getUserAddress(function (userAddress) {
            updateItem(address, userAddress);
            if (address === preparedArticle.address) {
                prepareArticle(address, userAddress);
            }
        });

        let body = String.format(lang.DownloadFinishedBody, pendingDownloads[address].title);
        Notifications.notify(lang.DownloadFinished, body, './assets/img/notifications.png', 10);
        pendingDownloads[address] = null;
    }
});

trantor.events.subscribe('onBeforePayment', 'main', function (args) {
    let tx = args[0];
    let txBuffer = args[1];
    let payment = args[2];
    let txBuilder = args[3];
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
                trantor.client.sendRawTransaction(txBuffer.toString('hex'), function (err, result) {
                    if (err) {
                        console.error(err);
                        modal.error({
                            message: err.message
                        });
                    } else {
                        console.log(result);
                        trantor.database.addPayment(payment, dTx, function (err, result) {
                            if (err) {
                                console.error(err);
                            } else {
                                Notifications.notify(lang.Payment, lang.PaymentSent, './assets/img/notification/wallet.png', 10);
                                getUserAddress(function (userAddress) {
                                    trantor.database.getMediaByAddress(payment.contentAddress, userAddress, function (err, result) {
                                        if (err) {
                                            console.log(err);
                                        } else {
                                            result = result[0];
                                            downloadPrivateFile(result.address, result.private_content);
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
            text: lang.Cancel
        }
    });

});

trantor.events.subscribe('onFollow', 'main', function (args) {
    let creaBuilder = args[0];
    let txBuffer = args[1];
    let data = args[2];
    let txBuilder = args[3];
    let dTx = DecodedTransaction.fromHex(txBuffer.toString('hex'));
    trantor.client.sendRawTransaction(txBuffer.toString('hex'), function (err, result) {
        if (err) {
            console.error(err);
        } else {
            trantor.database.addFollowing(data, dTx, new Date().getTime(), function () {
                setTimeout(function () {
                    mustReloadFollowers = true;
                    loadUserFollowedItems();
                }, 200);
            });
        }
    })
});

trantor.events.subscribe('onBeforeBlockContent', 'main', function (args) {
    let onBlock = function () {
        let creaBuilder = args[0];
        let txBuffer = args[1];
        let data = args[2];
        let txBuilder = args[3];
        let dTx = DecodedTransaction.fromHex(txBuffer.toString('hex'));
        trantor.client.sendRawTransaction(txBuffer.toString('hex'), function (err, result) {
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
            }
        }

    })

});

trantor.events.subscribe('onUnfollow', 'main', function (args) {
    let creaBuilder = args[0];
    let txBuffer = args[1];
    let data = args[2];
    let txBuilder = args[3];
    let dTx = DecodedTransaction.fromHex(txBuffer.toString('hex'));
    trantor.client.sendRawTransaction(txBuffer.toString('hex'), function (err, result) {
        if (err) {
            console.error(err);
            modal.error({
                message: err.message
            })
        } else {
            trantor.database.addFollowing(data, dTx, new Date().getTime(), function () {
                trantor.database.removeFollowing(data);
                setTimeout(function () {
                    mustReloadFollowers = true;
                    loadUserFollowedItems();
                }, 200);

            });
        }
    })
});

trantor.events.subscribe('onLog', 'main', function (args) {
    console.log.apply(console, args);
});

trantor.events.subscribe('onError', 'main', function (aguments) {
    let error = aguments[0][0];

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
    console.error.apply(console, aguments);
});

$('#modal-article').bind('onClassChanged', function () {
    console.log('onClassChanged');
    let isShowing = $('#modal-article').hasClass('in');

    if (mediaControl && !isShowing) {
        mediaControl.pause();
    }
});

function init() {
    loadAllMedia();
    loadUserFollowedItems();
    loadAbout();
    //invitationList();
    //controlMedia();
}

function reloadNotifications() {
    if (mustReloadNotifications) {
        loadAllNotifications();
        mustReloadNotifications = false;
    }
}

function loadAbout() {
    let version = pjson.version + ' ' + lang.VersionName;
    let osname = (OS.getPlatform() + ' ' + OS.getRelease() + ' ' + OS.getArch()).capitalize();

    $('#about-version').html(version.capitalize());
    $('#about-system').html(osname);
}

function updateItem(address, userAddress) {
    trantor.database.getMediaByAddress(address, userAddress, function (err, result) {
        //console.log(address, result);
        if (result.length > 0) {
            let data = result[0];

            let tooltipFollow = $('#content-item-tooltip-follow-' + data.address);
            tooltipFollow.attr('onmouseenter', "followButtonEnter('content-item-tooltip-follow-" + data.address + "', '" + data.author + "', " + data.following + ")")
                .attr('onmouseleave', "followButtonLeave('content-item-tooltip-follow-" + data.address + "', '" + data.author + "', " + data.following + ")");

            makeFollowButton('content-item-tooltip-follow-' + data.address, data.following);

            let featuredImage = getDefaultImageAndColor(data.content_type, data.featured_image);
            $('#content-item-image-' + address).css('background-image', "url('" + featuredImage.image + "')")
                .css('background-color', featuredImage.color);
            $('#content-item-title-' + address).html(data.title);
            $('#content-item-description-' + address).html(data.description);
            $('#content-item-like-count-' + address).html(data.likes);

            let icons = {
                NORMAL: './assets/img/like0.png',
                FILLED: './assets/img/like-filled.gif',
                OVER: './assets/img/like-border.png',
            };

            makeLikeButton('content-item-like-' + address, data.user_liked, address, icons);


            $('#content-item-comments-' + address).html(data.comments);

            let avatar = resolveAvatar(data.avatarFile, data.author);
            $('#content-item-author-avatar-' + address).attr('src', avatar);
            $('#content-item-author-' + address).html(data.name);

/*            let license = getLicenseData(data.license);
            let licIc = $('#content-item-license-');
            licIc.html('');
            license.icons.forEach(function (icon) {
                licIc.prepend(`<img src="${icon}" class="img-responsive">`)
            });

            licIc.attr('id', 'content-item-license-' + data.address);*/
        } else {
            loadAllMedia();
        }

    });

}

function prependItem(contentAddress) {
    if (!onSearch) {
        getUserAddress(function (userAddress) {
            trantor.database.getMediaByAddress(contentAddress, userAddress, function (err, result) {
                if (err) {
                    console.error(err);
                } else if (result.length > 0) {
                    result = result[0];
                    loadMediaItem(result, userAddress, true);
                }
            })
        })

    }
}

function showSearch(result, userAddress) {
    loadMediaItems(result, userAddress, false);
}

/**
 *
 * @param {Array} items
 * @param {string} userAddress
 * @param {boolean} prepend
 */
function loadMediaItems(items, userAddress, prepend = false) {
    articleList.html('');
    if (items) {
        items.forEach(function (item) {
            loadMediaItem(item, userAddress, prepend);
        })
    }
}

function downloadAuthorAvatar(authorAddress, avatarMagnet) {
    torrentClient.downloadTorrent(authorAddress, avatarMagnet, function (torrent, file, address) {
        //console.log('author torrent', avatarMagnet);
        let tHash = Utils.makeHash(avatarMagnet);
        trantor.database.putTorrent(tHash, avatarMagnet, torrent.path, file);
        //trantor.events.notify('onTorrentDownloaded', 100, address, torrent);

        setTimeout(function () {
            getUserAddress(function (userAddress) {
                trantor.database.getMediaByAuthor(authorAddress, userAddress, function (err, result) {
                    if (err) {
                        console.error(err);
                    } else if (result.length > 0) {
                        result.forEach(function (data) {
                            updateItem(data.address, userAddress)

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
        torrentClient.downloadTorrent(contentAddress, magnet, function (torrent, file, contentAddress) {
            let tHash = Utils.makeHash(torrent.magnetURI);
            trantor.database.putTorrent(tHash, magnet, torrent.path, file);
            //trantor.events.notify('onTorrentDownloaded', 100, contentAddress, torrent);
            setTimeout(function () {
                getUserAddress(function (userAddress) {
                    updateItem(contentAddress, userAddress);
                });
            }, 200);

        });
    }

}

function loadMediaItem(data, userAddress, prepend = false) {
    //console.log('Showing content', data);

    articleLoader.load('./elements/content-item.html', function () {
        if (!data.avatar_file) {
            downloadAuthorAvatar(data.user_address, data.avatar);
        }

        $('#content-item-').attr('onmouseenter', 'prepareArticle("' + data.address + '", "' + userAddress + '")')
            .attr('id', 'content-item-' + data.address);
        if (!data.featured_image) {
            downloadPublicFile(data.address, data.public_content)
        }

        let followButton = $('#content-item-tooltip-follow-');
        followButton.attr('id', 'content-item-tooltip-follow-' + data.address);
        if (userAddress === data.author) {
            followButton.addClass('hidden');
        } else {
            let isFollowing = data.following;

            followButton.attr('onmouseenter', "followButtonEnter('content-item-tooltip-follow-" + data.address + "', '" + data.author + "', " + isFollowing + ")")
                .attr('onmouseleave', "followButtonLeave('content-item-tooltip-follow-" + data.address + "', '" + data.author + "', " + isFollowing + ")");

            makeFollowButton('content-item-tooltip-follow-' + data.address, isFollowing);
        }

        let featuredImage = getDefaultImageAndColor(data.content_type, data.featured_image);
        //console.log('Comparing images', featuredImage.image, data.featured_image);
        $('#content-item-image-')
            .attr('style', 'background-image: url(' + featuredImage.image + '); background-color: ' + featuredImage.color + ';')
            .attr('id', 'content-item-image-' + data.address);


        $('#content-item-title-').html(data.title).attr('id', 'content-item-title-' + data.address);
        $('#content-item-description-').html(data.description).attr('id', 'content-item-description-' + data.address);
        $('#content-item-like-').attr('id', 'content-item-like-' + data.address);

        let icons = {
            NORMAL: './assets/img/like0.png',
            FILLED: './assets/img/like-filled.gif',
            OVER: './assets/img/like-border.png',
        };

        makeLikeButton('content-item-like-' + data.address, data.user_liked, data.address, icons);

        $('#content-item-like-count-').html(data.likes).attr('id', 'content-item-like-count-' + data.address);
        $('#content-item-comments-').html(data.comments).attr('id', 'content-item-comments-' + data.address);

        let avatar = resolveAvatar(data.avatarFile, data.author);
        $('#content-item-author-avatar-').attr('src', avatar)
            .attr('id', 'content-item-author-avatar-' + data.address);
        $('#content-item-author-').html(data.name)
            .attr('id', 'content-item-author-' + data.address);
        $('#content-item-tooltip-author-').html(data.name)
            .attr('onclick', "onLoadUser('" + data.author + "')")
            .attr('id', 'content-item-tooltip-author-' + data.address);
        $('#content-item-tooltip-avatar-').attr('src', avatar)
            .attr('onclick', "onLoadUser('" + data.author + "')")
            .attr('id', 'content-item-tooltip-avatar-' + data.address);

        $('#content-item-tooltip-web-').html(data.web).attr('id', 'content-item-tooltip-web-' + data.address);
        $('#content-item-tooltip-description-').html(data.user_description).attr('id', 'content-item-tooltip-description-' + data.address);
        $('#content-item-tooltip-email-').html(data.email).attr('id', 'content-item-tooltip-email-' + data.address);
        $('#content-item-tooltip-likes-').html(data.user_likes).attr('id', 'content-item-tooltip-likes-' + data.address);
        $('#content-item-tooltip-followers-').html(data.user_followers).attr('id', 'content-item-tooltip-followers-' + data.address);
        $('#content-item-tooltip-following-').html(data.user_following).attr('id', 'content-item-tooltip-following-' + data.address);

        let buzz = BUZZ.getBuzz(data.user_likes, data.user_comments, data.publications);
        $('#content-item-author-level-').attr('src', buzz.icon).attr('id', 'content-item-author-level-' + data.address);

        let item = articleLoader.html();
        if (prepend) {
            articleList.prepend(item);
        } else {
            articleList.append(item);
        }

        articleLoader.html('');
    });

}

function performFollow() {
    getUserAddress(function (userAddress) {
        trantor.database.getFollowingData(userAddress, preparedArticle.author, PUBLICATION.TYPE.FOLLOW, function (err, result) {
            if (err) {
                console.error(err);
            } else if (result.length > 0) {
                unFollowUser(preparedArticle.author);
            } else {
                followUser(preparedArticle.author);
            }
        })
    });
}

function showMediaResults(results, userAddress) {
    articleList.html('');
    results.forEach(function (row) {
        loadMediaItem(row, userAddress);
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
                results.forEach(function (row) {
                    loadMediaItem(row, userAddress);
                });
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
            console.log(followingMediaPage, results);
            if (err) {
                console.error(err);
            } else if (results.length > 0) {
                results.forEach(function (row) {
                    loadMediaItem(row, userAddress);
                });
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
                console.log(result);
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
        mustReloadFollowers = false;
        followedList.html('');
        getUserAddress(function (userAddress) {
            trantor.database.getFollowing(userAddress, userAddress, function (err, result) {

                if (err) {
                    console.error('Error', err);
                } else if (result.length > 0) {
                    //console.log(result);
                    followedList.removeClass('hidden');
                    $('#ui-no-follow').addClass('hidden');
                    result.forEach(function (user) {
                        loadUserFollowed(user, true);
                    })
                } else {
                    followedList.addClass('hidden');
                    $('#ui-no-follow').removeClass('hidden');
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
                $('#followed-' + followedAddress).attr('onclick', "onLoadUser('" + data.followed_address + "')");

                let avatar = resolveAvatar(data.avatarFile, data.followed_address, data);
                $('#followed-avatar-' + followedAddress).css('background-image', 'url(' + avatar + ')');
                $('#followed-name-' + followedAddress).html(data.name || lang.Anonymous);
                $('#followed-description-' + followedAddress).html(data.description || '-');
            }

        });
    })
}

function loadUserFollowed(data, prepend = false) {
    //console.log('User follow', data);
    followedLoader.load('./elements/following-item.html', function () {

        $('#followed-').attr('onclick', "onLoadUser('" + data.followed_address + "')")
            .attr('id', 'followed-' + data.followed_address);
        let avatar = resolveAvatar(data.avatarFile, data.followed_address, data);
        console.log(data, avatar);
        $('#followed-avatar-')
            .css('background', "url('" + avatar + "') center center")
            .css('background-size', 'cover')
            .attr('id', 'followed-avatar-' + data.followed_address);
        $('#followed-name-').html(data.name || lang.Anonymous).attr('id', 'followed-name-' + data.followed_address);
        $('#followed-description-').html(data.description || '-').attr('id', 'followed-description-' + data.followed_address);

        let item = followedLoader.html();
        if (prepend) {
            followedList.prepend(item);
        } else {
            followedList.append(item);
        }

        followedLoader.html('');
    });
}

function removeFollowed(followedAddress) {
    $('#followed-' + followedAddress).remove();
}

function prepareArticle(address, userAddress) {
    console.log('preparing article', address, userAddress);
    trantor.database.getMediaByAddress(address, userAddress, function (err, result) {
        console.log(result);
        preparedArticle = result[0];

        setTimeout(function () {
            loadComments(address);
        }, 10);

        let authorAvatar = resolveAvatar(preparedArticle.avatarFile, preparedArticle.author, 50);
        trantor.getUserData(userAddress, userAddress, function (err, data) {
            data = data[0];
            let avatarFile = data ? data.avatarFile : null;
            let userAvatar = resolveAvatar(avatarFile, userAddress);
            $('#article-comment-avatar').attr('src', userAvatar);
        });

        if (userAddress === preparedArticle.author) {
            $('#article-follow').html(lang.Edit)
                .removeAttr('onmouseenter')
                .removeAttr('onmouseleave')
                .unbind('click')
                .click(function () {
                    prepareArticleEdition(preparedArticle)
                })
        } else {
            let articleFollow = $('#article-follow');
            articleFollow.removeClass('hidden');
            trantor.database.getFollowingData(userAddress, preparedArticle.author, PUBLICATION.TYPE.FOLLOW, function (err, result) {

                if (err) {
                    console.error(err);
                } else {
                    let following = result.length > 0;
                    articleFollow.attr('onmouseenter', "followButtonEnter('article-follow', '" + preparedArticle.author + "', " + following + ")")
                        .attr('onmouseleave', "followButtonLeave('article-follow', '" + preparedArticle.author + "', " + following + ")");
                    makeFollowButton('article-follow', following);

                }
            });
        }

        makeLikeButton('article-like', preparedArticle.user_liked, preparedArticle.address);

        //Show media controls for audio and video
        let contentType = preparedArticle.content_type.toLowerCase();
        let featuredImage = getDefaultImageAndColor(preparedArticle.content_type, preparedArticle.featured_image);
        if (contentType.indexOf('video') > -1 && preparedArticle.private_file) {
            $('#article-featured-image').addClass('hidden');
            $('#article-audio').addClass('hidden');
            $('#article-video')
                .attr('poster', featuredImage.image)
                .html('<source src="' + preparedArticle.private_file + '" type="' + contentType + '">')
                .removeClass('hidden')
                .css('display', 'block')
                .css('background-color', featuredImage.color);
            mediaControl = $('#article-video');
        } else if (contentType.indexOf('audio') > -1 && preparedArticle.private_file) {
            $('#article-featured-image').addClass('hidden');
            $('#article-video').addClass('hidden');
            $('#article-audio').html('<source src="' + preparedArticle.private_file + '" type="' + contentType + '">')
                .removeClass('hidden')
                .css('display', 'block');
            mediaControl = $('#article-audio');
        } else {
            $('#article-video').addClass('hidden');
            $('#article-audio').addClass('hidden');
            $('#article-featured-image')
                .removeClass('hidden')
                .attr('src', featuredImage.image)
                .css('background-color', featuredImage.color);
        }

        if (File.exist(preparedArticle.private_file)) {
            let stat = File.fileInfo(preparedArticle.private_file);
            $('#article-size').html(stat.formatSize.human('jedec'))
        } else if (File.exist(preparedArticle.featured_image) && !(preparedArticle.private_content && preparedArticle.private_content.length > 0)) {
            let stat = File.fileInfo(preparedArticle.featured_image);
            $('#article-size').html(stat.formatSize.human('jedec'))
        } else {
            $('#article-size').html('0.00 B');
        }

        $('#article-author-avatar').attr('src', authorAvatar)
            .attr('onclick', "onLoadUser('" + preparedArticle.author + "')");
        $('#article-author-name').html(preparedArticle.name)
            .attr('onclick', "onLoadUser('" + preparedArticle.author + "')");
        $('#article-author-web').html(preparedArticle.web || preparedArticle.user_description);
        $('#article-title').html(preparedArticle.title);
        $('#article-description').html(preparedArticle.description);
        let tags = '';
        if (preparedArticle.tags && preparedArticle.tags.length > 0) {
            tags = linkTags(JSON.parse(preparedArticle.tags));
        }

        $('#article-tags').html(tags);
        $('#article-format').html(preparedArticle.content_type);
        if (preparedArticle.price && preparedArticle.private_content && preparedArticle.private_content.length > 0) {
            let price = Coin.parseCash(preparedArticle.price, 'CREA');
            //console.log(price.toFriendlyString());
            $('#article-crea').html(price.toFriendlyString());
        } else {
            $('#article-crea').html(lang.FreeDownload);
        }

        $('#article-date').html(moment(preparedArticle.creation_date).format('LLLL'));
        $('#article-likes').html(preparedArticle.likes + ' ' + lang.Likes);
        $('#article-like').attr('onclick', "makeLike('" + preparedArticle.address + "', " + preparedArticle.user_liked + ")");
        $('#article-comments').html(preparedArticle.comments + ' ' + lang.Comments);

        let buzz = BUZZ.getBuzz(preparedArticle.user_likes, preparedArticle.user_comments, preparedArticle.publications);

        $('#article-author-level-icon').attr('src', buzz.icon);
        $('#article-author-level').html(buzz.levelText);
        $('#article-author-buzz').html(buzz.rate + ' Buzz');

        $('#article-comment-button').attr('onclick', "publishComment('" + preparedArticle.address + "')");
        $('#article-comment').val('');

        let privateFile = preparedArticle.private_file;

        let articleInfo = $('#article-download-info');

        if (privateFile && privateFile.length > 0) {
            articleInfo.removeClass('hidden');
            $('#article-download').html(lang.Save);
        } else if (preparedArticle.private_content && preparedArticle.private_content.length > 0) {
            articleInfo.removeClass('hidden');
            $('#article-download').html(lang.Download);
        } else {
            articleInfo.addClass('hidden');
        }

        $('#article-address').html(preparedArticle.address);
        $('#article-txid').html('<a href="" onclick="return openUrlInBrowser(\'https://chainz.cryptoid.info/crea/tx.dws?' + preparedArticle.txid + '.htm\')">' + preparedArticle.txid + '</a>');
        $('#article-timestamp').html(moment(preparedArticle.creation_date).format('LLLL'));

        $('#article-block').click(function () {
            if (userAddress !== preparedArticle.author) {
                blockContent(preparedArticle.address);
            }

        });

        $('#article-block-user').click(function () {
            if (userAddress !== preparedArticle.author) {
                blockContent(preparedArticle.author);
            }
        });

        let license = getLicenseData(preparedArticle.license);
        //console.log(license);
        let licenseList = $('#article-license-list');
        licenseList.html('');

        $('#article-license').html('<a href="" onclick="return openUrlInBrowser(\'' + license.link + '\')">' + license.name + '</a>');
        license.icons.forEach(function (i) {
            let iconHtml = '<li><img src="' + i + '" alt=""></li>';
            licenseList.append(iconHtml);
        })

    });
}

function loadComments(contentAddress) {
    let commentList = $('#article-comment-list');
    commentList.html('');

    trantor.database.getComments(contentAddress, function (err, comments) {
        if (err) {
            console.error(err);
        } else {
            let commentLoader = $('#comment-items');

            comments.forEach(function (comment) {

                commentLoader.load('./elements/article-comment.html', function () {
                    let avatar = resolveAvatar(comment.avatarFile, comment.author);
                    let buzz = BUZZ.getBuzz(comment.user_likes, 0);

                    $('#comment-author-avatar').attr('src', avatar)
                        .attr('onclick', "onLoadUser('" + comment.author + "')")
                        .attr('id', 'comment-author-avatar-' + comment.txid);

                    $('#comment-author-name').html(comment.name)
                        .attr('onclick', "onLoadUser('" + comment.author + "')")
                        .attr('commnet-author-name-' + comment.txid);

                    $('#comment-author-level-icon').attr('src', buzz.icon)
                        .attr('comment-author-level-icon-' + comment.txid);

                    $('#comment-date').html(new Date(comment.creation_date).toLocaleString())
                        .attr('comment-date-' + comment.txid);

                    $('#comment-text').html(comment.comment)
                        .attr('comment-text-' + comment.txid);

                    let commentItem = commentLoader.html();
                    commentList.append(commentItem);
                });

            });


        }
    })

}

function publishComment(contentAddress) {
    console.log('Preparing to comment');
    let comment = removeHtml($('#article-comment').val());
    if (comment && comment.length > 0) {
        console.log('Commenting', comment);
        getUserAddress(function (userAddress) {
            trantor.makeComment(userAddress, contentAddress, comment);
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
            trantor.makeLike(userAddress, address, likeAmount);
        });
    } else {
        console.log('User has like in this content');
    }
}

function downloadPrivateFile(contentAddress, privateFile) {
    torrentClient.downloadTorrent(contentAddress, privateFile, function (torrent, file, contentAddress) {
        let tHash = Utils.makeHash(torrent.magnetURI);
        trantor.database.putTorrent(tHash, torrent.magnetURI, torrent.path, file);
        trantor.events.notify('onTorrentDownloaded', 100, contentAddress, torrent);
    }, true);
    paymentAddresses[contentAddress] = { pending: true };
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
        pendingDownloads[preparedArticle.address] = preparedArticle;
        getUserAddress(function (userAddress) {
            trantor.database.getPayment(userAddress, preparedArticle.address, function (err, result) {
                if (err) {
                    console.error(err);
                } else {
                    if (result[0]) {
                        downloadPrivateFile(preparedArticle.address, privateTorrent);
                        Notifications.notify(lang.Files, lang.DownloadFileStart, './assets/img/wallet/icon-receive.png', 5);
                    } else {
                        if (preparedArticle.price > 0) {
                            trantor.makeContentPayment(userAddress, preparedArticle.address);
                        } else {
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
            trantor.makeFollow(userAddress, followedAddress);
        }

    })
}

function unFollowUser(followedAddress) {
    console.log('Unfollow', followedAddress);
    getUserAddress(function (userAddress) {
        trantor.makeUnfollow(userAddress, followedAddress);
    })
}

function prepareArticleEdition(article) {
    $('#modal-article').modal('hide');

    setTimeout(function () {
        editArticle(article);
    }, 400);
}
