
let articleList = $('#ui-posts');
let followedList = $('#following-list');
let articleLoader = $('#publication-items');
let followedLoader = $('#follows-items');

let preparedArticle;
let onSearch = false;
let mustReloadContent = true;
let paymentAddresses = {};

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
    loadUserThatFollows();
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
            try {
                torrentClient.downloadTorrent(data.address, data.avatar, function (torrent, file, contentAddress) {
                    let tHash = Utils.makeHash(data.avatar);
                    trantor.database.putTorrent(tHash, data.avatar, torrent.path, file);
                    trantor.events.notify('onTorrentDownloaded', 100, contentAddress, torrent);
                });
            } catch (err) {
                console.log(err);
            }
            trantor.database.addAuthor(data, tx, blockTime, function () {
                refreshUserData();
            });
            break;
        case PUBLICATION.TYPE.CONTENT:
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
                        prependItem(tx.hash);
                    }, 500);
                }
            });

            getUserAddress(function (userAddress) {
                trantor.database.getFollower(userAddress, data.userAddress, function (err, result) {
                    if (err) {
                        console.error(err);
                    } else if (result.length > 0) {
                        //Add notification that following user added new content
                        trantor.database.insertNotification(data.userAddress, data.type, data.address, blockTime)
                    }
                })
            });
            break;
        case PUBLICATION.TYPE.COMMENT:
            trantor.insertComment(data, tx, blockTime, function () {
                console.log('Comment added!');
                if (preparedArticle && (preparedArticle.address === data.contentAddress)) {
                    prepareArticle(preparedArticle.address);
                }
            });

            getUserAddress(function (userAddress) {
                trantor.database.getMediaByAddress(data.contentAddress, function (err, result) {
                    if (err) {
                        console.error(err);
                    } else if (result.length > 0) {
                        result = result[0];
                        if (result.user_address = userAddress) {
                            tantor.database.getFollower(userAddress, data.author, function (err, result) {
                                if (err) {
                                    console.error(err);
                                } else if (result.length > 0) {
                                    //Add notification that following user added commented user content
                                    trantor.database.insertNotification(data.author, data.type, data.contentAddress, blockTime)
                                }
                            })
                        }
                    }
                });

            });

            break;
        case PUBLICATION.TYPE.LIKE:
            trantor.database.addLike(data, tx, function () {
                console.log('Like added!');
                if (preparedArticle && (preparedArticle.address === data.contentAddress)) {
                    prepareArticle(preparedArticle.address);
                }
            });

            getUserAddress(function (userAddress) {
                trantor.database.getMediaByAddress(data.contentAddress, function (err, result) {
                    if (err) {
                        console.error(err);
                    } else if (result.length > 0) {
                        result = result[0];
                        if (result.user_address = userAddress) {
                            trantor.database.getFollower(userAddress, data.author, function (err, result) {
                                if (err) {
                                    console.error(err);
                                } else if (result.length > 0) {
                                    //Add notification that following user added commented user content
                                    trantor.database.insertNotification(data.author, data.type, data.contentAddress, blockTime)
                                }
                            })
                        }
                    }
                });

            });

            break;
        case PUBLICATION.TYPE.UNLIKE:
            trantor.database.addUnlike(data, tx, function () {
                console.log('Unlike added!');
                if (preparedArticle && (preparedArticle.address === data.contentAddress)) {
                    prepareArticle(preparedArticle.address);
                }
            });
            break;
        case PUBLICATION.TYPE.PAYMENT:
            trantor.database.addPayment(data, tx, function () {
                console.log('Payment added!');
                if (preparedArticle && (preparedArticle.address === data.contentAddress)) {
                    prepareArticle(preparedArticle.address);
                }
            });

            trantor.database.getMediaByAddress(data.contentAddress, function (err, result) {
                if (err) {
                    console.error(err);
                } else {
                    console.log(result);
                    result = result[0];
                    getUserAddress(function (address) {
                        if (address === data.author) {
                            downloadPrivateFile(data.contentAddress, result.private_file);
                        }
                    });
                }

            });
            break;
        case PUBLICATION.TYPE.FOLLOW:
        case PUBLICATION.TYPE.UNFOLLOW:
            trantor.database.addFollowing(data, tx, blockTime, function (err) {
                if (err) {
                    console.error(err)
                } else {
                    if (data.type === PUBLICATION.TYPE.UNFOLLOW) {
                        trantor.database.removeFollowing(data)
                    }
                }
                loadUserThatFollows();
            });

            if (data.type === PUBLICATION.TYPE.FOLLOW) {
                getUserAddress(function (userAddress) {
                    if (data.followedAddress === userAddress) {
                        trantor.database.insertNotification(data.followerAddress, data.type, data.followedAddress, blockTime)
                    }
                });
            }

    }

    mustReloadContent = true;

    setTimeout(function () {
        loadAllMedia();
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
    trantor.insertMedia(media, tx, new Date().getTime(), function (err) {
        if (err) {
            console.error(err);
            modal.error({
                message: err
            })
        } else {
            console.log('Media inserted!');
            //modal.hide(false);
            prependItem(tx.hash);

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
            prepareArticle(like.contentAddress);
        }
    });

    mustReloadContent = true;
});

/**
 *
 * @param {TransactionBuilder} txBuilder
 * @param {Array} spendables
 */
trantor.events.subscribe('onBeforeTransactionSend', 'index',function (txBuilder, spendables) {
    let t = '';
    let txMessage = String.format(lang['TxSendMessage'], Coin.parseCash(txBuilder.getFee(), 'CREA').toString());
    modal.alert({
        message: txMessage,
        ok: {
            onclick: function () {
                let onSign = function () {
                    trantor.signTransaction(txBuilder, spendables, function (err, txHex) {
                        if (err) {
                            modal.error({
                                message: err.message
                            })
                        }
                        trantor.sendRawTransaction(txHex, function (err, result) {
                            if (err) {
                                console.error(err);
                                modal.error({
                                    message: err.message
                                })
                            } else {
                                trantor.events.notify('onAfterTransactionSend', 10, result);
                            }
                        })
                    })
                };

                onSign();
            }
        },
        cancel: {
            text: lang.Cancel
        }
    });
});

/**
 *
 * @param {DecodedTransaction} tx
 */
trantor.events.subscribe('onAfterTransactionSend', 'main',function (args) {
    let tx = args[0];
    Notifications.notify(lang['TransactionSend'], tx.hash, './assets/img/wallet-alert.png', 2);
});

trantor.events.subscribe('onTorrentDownloaded', 'main', function (args) {
    //console.log('Torrent available', args);
    let address = args[0];
    let torrent = args[1];


    if (paymentAddresses[address] && paymentAddresses[address].pending) {
        updateItem(address);
        Notifications.notify(lang.DownloadFinished, lang.DownloadFinishedBody, './assets/img/notifications.png', 10);
    }
});

trantor.events.subscribe('onBeforePayment', 'main', function (args) {
    let tx = args[0];
    let txBuffer = args[1];
    let payment = args[2];
    let txBuilder = args[3];
    let dTx = DecodedTransaction.fromHex(txBuffer.toString('hex'));
    let fee = Coin.parseCash(txBuilder.txFee, 'CREA');
    let totalOutAmount = Coin.parseCash(txBuilder.outputSumAmount, 'CREA');
    let totalAmount = Coin.parseCash(totalOutAmount.amount + fee.amount, 'CREA');

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
                                console.log(err);
                            } else {
                                Notifications.notify(lang.Payment, lang.PaymentSent, './assets/img/wallet-alert.png', 10);
                                trantor.database.getMediaByAddress(payment.contentAddress, function (err, result) {
                                    if (err) {
                                        console.log(err);
                                    } else {
                                        result = result[0];
                                        downloadPrivateFile(result.address, result.private_content);
                                    }
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
               loadUserThatFollows();
            });
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
        } else {
            trantor.database.addFollowing(data, dTx, new Date().getTime(), function () {
                trantor.database.removeFollowing(data);
                loadUserThatFollows();
            });
        }
    })
});

trantor.events.subscribe('onLog', 'main', function (args) {
    console.log.apply(console, args);
});

trantor.events.subscribe('onError', 'main', function (args) {
    console.error.apply(console, args);
});

function init() {
    loadAllMedia();
    loadUserThatFollows();
    invitationList();
    //controlMedia();
}

function updateItem(address) {
    trantor.database.getMediaByAddress(address, function (err, result) {
        //console.log(address, result);
        if (result.length > 0) {
            let data = result[0];

            getUserAddress(function (userAddress) {
                trantor.database.getFollowingData(userAddress, data.author, PUBLICATION.TYPE.FOLLOW, function (err, result) {
                    if (err) {
                        console.error(err);
                    } else if (result.length > 0) {
                        $('#content-item-tooltip-follow-' + address).html(lang.Unfollow);

                    } else {
                        $('#content-item-tooltip-follow-' + address).html(lang.Follow);
                    }
                });
            });

            let featuredImage = getDefaultImageAndColor(data.content_type, data.featured_image);
            $('#content-item-image-' + address).css('background-image', "url('" + featuredImage.image + "')");
            $('#content-item-image-' + address).css('background-color', featuredImage.color);
            $('#content-item-title-' + address).html(data.title);
            $('#content-item-description-' + address).html(data.description);
            $('#content-item-like-count-' + address).html(data.likes);
            $('#content-item-comments-' + address).html(data.comments);

            let avatar = File.exist(data.avatarFile) ? data.avatarFile : 'https://api.adorable.io/avatars/40/'+ data.author;
            $('#content-item-author-avatar-' + address).attr('src', avatar);
            $('#content-item-author-' + address).html(data.name);
        } else {
            loadAllMedia();
        }

    });

}

function prependItem(txId) {
    if (!onSearch) {
        trantor.database.getMediaByContentId(txId, function (err, result) {
            if (err) {
                console.error(err);
            } else if (result.length > 0) {
                result = result[0];
                loadMediaItem(result, true)
            }
        })
    }
}

function showSearch(result) {
    loadMediaItems(result, false);
}

/**
 *
 * @param {Array} items
 * @param {boolean} prepend
 */
function loadMediaItems(items, prepend = false) {
    articleList.html('');
    if (items) {
        items.forEach(function (item) {
            loadMediaItem(item, prepend);
        })
    }
}

function downloadAuthorAvatar(authorAddress, avatarMagnet) {
    torrentClient.downloadTorrent(authorAddress, avatarMagnet, function (torrent, file, address) {
        //console.log('author torrent', avatarMagnet);
        let tHash = Utils.makeHash(avatarMagnet);
        //trantor.database.putTorrent(tHash, avatarMagnet, torrent.path, file);
        trantor.events.notify('onTorrentDownloaded', 100, address, torrent);
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
            //trantor.database.putTorrent(tHash, magnet, torrent.path, file);
            trantor.events.notify('onTorrentDownloaded', 100, contentAddress, torrent);
        });
    }

}

function loadMediaItem(data, prepend = false) {
    //console.log('Showing content', data);

    articleLoader.load('./elements/content-item.html', function () {
        downloadAuthorAvatar(data.user_address, data.avatar);
        $('#content-item-').attr('onmouseenter', 'prepareArticle("' + data.address + '")').attr('id', 'content-item-' + data.address);
        if (!data.featured_image) {
            downloadPublicFile(data.address, data.public_content)
        }

        getUserAddress(function (userAddress) {
            trantor.database.getFollowingData(userAddress, data.author, PUBLICATION.TYPE.FOLLOW, function (err, result) {
                if (err) {
                    console.error(err);
                } else if (result.length > 0) {
                    $('#content-item-tooltip-follow-').html(lang.Unfollow);

                } else {
                    $('#content-item-tooltip-follow-').html(lang.Follow);
                }
            });

            $('#content-item-tooltip-follow-').attr('id', 'content-item-tooltip-follow-' + data.address);
        });

        let featuredImage = getDefaultImageAndColor(data.content_type, data.featured_image);
        $('#content-item-image-').css('background-image', "url('" + featuredImage.image + "')");
        $('#content-item-image-').css('background-color', featuredImage.color).attr('id', 'content-item-image-' + data.address);


        $('#content-item-title-').html(data.title).attr('id', 'content-item-title-' + data.address);
        $('#content-item-description-').html(data.description).attr('id', 'content-item-description-' + data.address);
        $('#content-item-like-count-').html(data.likes).attr('id', 'content-item-like-count-' + data.address);
        $('#content-item-comments-').html(data.comments).attr('id', 'content-item-comments-' + data.address);

        let avatar = resolveAvatar(data.avatarFile, data.author);
        $('#content-item-author-avatar-').attr('src', avatar).attr('id', 'content-item-author-avatar-' + data.address);
        $('#content-item-author-').html(data.name).attr('id', 'content-item-author-' + data.address);
        $('#content-item-tooltip-author-').html(data.name).attr('id', 'content-item-tooltip-author-' + data.address);
        $('#content-item-tooltip-avatar-').attr('src', avatar);
        $('#content-item-tooltip-avatar-').attr('id', 'content-item-tooltip-avatar-' + data.address);

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

function showMediaResults(results) {
    articleList.html('');
    results.forEach(function (row) {
        loadMediaItem(row);
    })
}

function loadAllMedia() {
    if (!onSearch) {
        if (mustReloadContent) {
            trantor.database.getAllMedia(function (err, result) {
                if (err) {
                    console.error(err);
                } else {
                    showMediaResults(result);
                }
            });

            mustReloadContent = false;
        }
    }
}

function loadFollowingMedia() {
    getUserAddress(function (userAddress) {
        trantor.database.getMediaByFollowerAddress(userAddress, function (err, result) {
            if (err) {
                console.error(err);
            } else {

                console.log(result);
                showMediaResults(result);
            }
        });
        mustReloadContent = true;
    });

}

function showLatestMedia() {
    loadAllMedia();
    return false;
}

function showFollowingMedia() {
    loadFollowingMedia();
    return false;
}

function loadUserThatFollows() {
    followedList.html('');

    getUserAddress(function (userAddress) {
        trantor.database.getFollowing(userAddress, function (err, result) {

            if (err) {
                console.error('Error', err);
            } else {
                //console.log(result);
                result.forEach(function (user) {
                    loadUserFollows(user, true);
                })
            }

        });
    });

}

function onLoadUser(address) {
    loadProfileData(address, false);
    showProfileView();
}

function loadUserFollows(data, prepend = false) {
    followedLoader.load('./elements/following-item.html', function () {

        $('#following-').attr('onclick', "onLoadUser('" + data.address + "');");

        $('#following-').attr('id', 'following-' + data.address);
        let avatar = resolveAvatar(data.avatarFile, data.address);
        $('#follower-avatar-').attr('src', avatar).attr('id', 'follower-avatar-' + data.address);
        $('#follower-name-').html(data.name).attr('id', 'follower-name-' + data.address);
        $('#follower-description-').html(data.description || data.web).attr('id', 'follower-name-' + data.address);

        let item = followedLoader.html();
        if (prepend) {
            followedList.prepend(item);
        } else {
            followedList.append(item);
        }

        followedLoader.html('');
    });
}

function prepareArticle(address) {
    console.log('preparing article', address);
    trantor.database.getMediaByAddress(address, function (err, result) {
        console.log(result);
        preparedArticle = result[0];

        setTimeout(function () {
            loadComments(address);
        }, 10);

        let authorAvatar = resolveAvatar(preparedArticle.avatarFile, preparedArticle.author, 50);
        getUserAddress(function (userAddress) {
            trantor.getUserData(userAddress, function (err, data) {
                data = data[0];
                let avatarFile = data ? data.avatarFile : null;
                let userAvatar = resolveAvatar(avatarFile, userAddress);
                $('#article-comment-avatar').attr('src', userAvatar);
            });

            if (userAddress === preparedArticle.author) {
                $('#article-follow').css('display', 'none');
            } else {
                $('#article-follow').css('display', 'inherit');
                trantor.database.getFollowingData(userAddress, preparedArticle.author, PUBLICATION.TYPE.FOLLOW, function (err, result) {
                    if (err) {
                        console.error(err);
                    } else if (result.length > 0) {
                        $('#article-follow').html(lang.Unfollow);
                        $('#article-follow').click(function () {
                            unFollowUser(preparedArticle.author);
                        })
                    } else {
                        $('#article-follow').click(function () {
                            followUser(preparedArticle.author);
                        })
                    }

                })
            }
        });

        //Show media controls for audio and video
        let contentType = preparedArticle.content_type.toLowerCase();
        if (contentType.indexOf('video') > -1 && preparedArticle.private_file) {
            $('#article-featured-image').css('display', 'none');
            $('#article-audio').css('display', 'none');
            $('#article-video').html('<source src="' + preparedArticle.private_file + '" type="' + contentType + '">');
            $('#article-video').css('display', 'block');
        } else if (contentType.indexOf('audio') > -1 && preparedArticle.private_file) {
            $('#article-featured-image').css('display', 'none');
            $('#article-video').css('display', 'none');
            $('#article-audio').html('<source src="' + preparedArticle.private_file + '" type="' + contentType + '">');
            $('#article-audio').css('display', 'block');
        } else {
            let featuredImage = getDefaultImageAndColor(preparedArticle.content_type, preparedArticle.featured_image);
            $('#article-video').css('display', 'none');
            $('#article-audio').css('display', 'none');
            $('#article-featured-image').css('display', 'inherit');
            $('#article-featured-image').attr('src', featuredImage.image);
            $('#article-featured-image').css('background-color', featuredImage.color);
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

        $('#article-author-avatar').attr('src', authorAvatar);
        $('#article-author-name').html(preparedArticle.name);
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
            console.log(price.toFriendlyString());
            $('#article-crea').html(price.toFriendlyString());
        } else {
            $('#article-crea').html(lang.FreeDownload);
        }

        $('#article-date').html(new Date(preparedArticle.creation_date).toLocaleString());
        $('#article-likes').html(preparedArticle.likes + ' ' + lang.Likes);
        $('#article-comments').html(preparedArticle.comments + ' ' + lang.Comments);

        let buzz = BUZZ.getBuzz(preparedArticle.user_likes, preparedArticle.user_comments, preparedArticle.publications);

        $('#article-author-level-icon').attr('src', buzz.icon);
        $('#article-author-level').html(buzz.levelText);
        $('#article-author-buzz').html(buzz.rate + ' Buzz');

        $('#article-comment-button').attr('onclick', "publishComment('" + preparedArticle.address + "')");
        $('#article-comment').val('');

        let privateTorrent = preparedArticle.private_content;

        if (privateTorrent && privateTorrent.length > 0) {
            $('#article-download').prop('disabled', false);
        } else {
            $('#article-download').prop('disabled', true);
        }


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
            commentLoader.load('./elements/article-comment.html', function () {
                comments.forEach(function (comment) {
                    let avatar = resolveAvatar(comment.avatarFile, comment.author, 80);
                    let buzz = BUZZ.getBuzz(comment.user_likes, 0);
                    $('#comment-author-avatar').attr('src', avatar);
                    $('#comment-author-name').html(comment.name);
                    $('#comment-author-level-icon').attr('src', buzz.icon);
                    $('#comment-date').html(new Date(comment.creation_date).toLocaleString());
                    $('#comment-text').html(comment.comment);

                    let commentItem = commentLoader.html();
                    commentList.append(commentItem);
                });
            });
        }
    })
}

function publishComment(contentAddress) {
    console.log('Preparing to comment');
    let comment = $('#article-comment').val();
    if (comment && comment.length > 0) {
        console.log('Commenting', comment);
        getUserAddress(function (userAddress) {
            trantor.makeComment(userAddress, contentAddress, comment);
        });
    } else {
        //TODO: SHOW Empty comment error
    }
}

function makeLike() {
    if (!preparedArticle.user_liked) {
        console.log('making like');
        let appStorage = FileStorage.load();
        let likeAmount = Coin.parseCash(appStorage.getKey('action-amount'), 'CREA').amount;
        getUserAddress(function (userAddress) {
            trantor.makeLike(userAddress, preparedArticle.address, likeAmount);
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
        getUserAddress(function (userAddress) {
            trantor.database.getPayment(userAddress, preparedArticle.address, function (err, result) {
                torrentClient.getTorrent(privateTorrent, function (torrent) {
                    if (err) {
                        console.log(err);
                    } else {
                        if (result[0]) {
                            if (torrent) {
                                Notifications.notify(lang.Files, lang.DownloadPending, './assets/img/wallet/icon-receive.png', 5);
                            } else {
                                downloadPrivateFile(preparedArticle.address, privateTorrent);
                                Notifications.notify(lang.Files, lang.DownloadFileStart, './assets/img/wallet/icon-receive.png', 5);
                            }
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
