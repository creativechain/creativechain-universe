
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
});

trantor.events.subscribe('onDataFound', 'main', function (args) {
    let tx = args[0];
    let data = args[1];
    let blockTime = args[2];

    console.log('Data found', data);

    switch (data.type) {
        case PUBLICATION.TYPE.USER:
            try {
                torrentClient.downloadTorrent(data.address, data.avatar, false);
            } catch (err) {
                console.log(err);
            }
            trantor.database.addAuthor(data, tx, blockTime, function () {
                refreshUserData();
            });
            break;
        case PUBLICATION.TYPE.CONTENT:
            torrentClient.downloadTorrent(data.contentAddress, data.publicContent);
            trantor.insertMedia(data, tx, blockTime, function () {
                prependItem(tx.hash);
            });
            break;
        case PUBLICATION.TYPE.COMMENT:
            trantor.insertComment(data, tx, blockTime, function () {
                console.log('Comment added!');
                if (preparedArticle && (preparedArticle.address === data.contentAddress)) {
                    prepareArticle(preparedArticle.address);
                }
            });
            break;
        case PUBLICATION.TYPE.LIKE:
            trantor.database.addLike(data, tx, function () {
                console.log('Like added!');
                if (preparedArticle && (preparedArticle.address === data.contentAddress)) {
                    prepareArticle(preparedArticle.address);
                }
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
                    let result = result[0];
                    getUserAddress(function (address) {
                        if (address === data.author) {
                            downloadPrivateFile(data.contentAddress, result.private_file);
                        }
                    });
                }

            });

            break;

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
        } else {
            console.log('Media inserted!');
            prependItem(tx.hash);
        }
    });

    mustReloadContent = true;
});

trantor.events.subscribe('onBeforeLike', 'main', function (args) {
    let txBuffer = args[0];
    let like = args[1];

    trantor.client.sendRawTransaction(txBuffer.toString('hex'), function (err, result) {
        if (err) {
            console.log(err);
        } else {
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
    let send = dialogs.confirm(txMessage);

    if (send) {
        let onSign = function () {
            trantor.signTransaction(txBuilder, spendables, function (err, txHex) {
                if (err) {
                    let passphrase = prompt(lang['EnterWalletPassphrase']);
                    trantor.decryptWallet(passphrase, 10, function (err, result) {
                        if (err) {

                        } else {
                            localStorage.setItem('password', passphrase);
                        }
                    })
                }
                trantor.sendRawTransaction(txHex, function (err, result) {
                    if (err) {
                        console.error(err);
                        dialogs.alert(err.message);
                    } else {
                        result.hash = result.result;
                        trantor.events.notify('onAfterTransactionSend', 10, result);
                    }
                })
            })
        };

        onSign();
    }
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
    console.log('Torrent available', args);
    let address = args[0];
    let torrent = args[1];
    updateItem(address);

    if (paymentAddresses[address] && paymentAddresses[address].pending) {
        Notifications.notify(lang.DownloadFinished, lang.DownloadFinishedBody, './assets/img/notifications.png', 10);
    }
});

trantor.events.subscribe('onBeforePayment', 'main', function (args) {
    let tx = args[0];
    let txBuffer = args[0];
    let payment = args[1];

    let fee = Coin.parseCash(tx.getFee(), 'CREA');
    let totalOutAmount = Coin.parseCash(tx.outputSumAmount, 'CREA');
    let totalAmount = Coin.parseCash(totalOutAmount.amount + fee.amount, 'CREA');

    let paymentBody = String.format(lang.PaymentBody, fee.toFriendlyString(), totalOutAmount.toFriendlyString(), totalAmount.toFriendlyString());
    dialogs.confirm(paymentBody, function (ok) {
        if (ok) {
            trantor.client.sendRawTransaction(txBuffer.toString('hex'), function (err, result) {
                if (err) {
                    console.log(err);
                    dialogs.alert(err.message);
                } else {
                    Notifications.notify(lang.Payment, lang.PaymentSent, './assets/img/wallet-alert.png', 10);
                }
            })
        }
    })

});

trantor.events.subscribe('onLog', 'main', function (args) {
    console.log(args);
});

function init() {
    //console.log('QueryUrl:', window.location.href);
    let searchValue = Utils.getQueryValue(window.location.href, 'search');
    if (searchValue) {
        performSearch(searchValue);
    } else {
        loadAllMedia();
    }
    loadUserThatFollows();
    //controlMedia();
}

function updateItem(address) {
    trantor.database.getMediaByAddress(address, function (err, result) {
        console.log(address, result);
        let data = result[0];
        $('#content-item-image-' + address).attr('src', data.featured_image);
        $('#content-item-title-' + address).html(data.title);
        $('#content-item-description-' + address).html(data.description);
        $('#content-item-like-count-' + address).html(data.likes);
        $('#content-item-comments-' + address).html(data.comments);

        let avatar = File.exist(data.avatarFile) ? data.avatarFile : 'https://api.adorable.io/avatars/40/'+ data.author;
        $('#content-item-author-avatar-' + address).attr('src', avatar);
        $('#content-item-author-' + address).html(data.name);
    });

}

function prependItem(txId) {
    if (!onSearch) {
        trantor.database.getMediaByContentId(txId, function (result) {
            if (result) {
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

/**
 *
 * @param {string} mimeType
 * @param {string} featuredImage
 * @returns {{}}
 */
function getDefaultImageAndColor(mimeType, featuredImage) {
    if (mimeType) {
        mimeType = mimeType.toLowerCase();

        let res = {};
        if (featuredImage && featuredImage.length > 0) {
            res.image = featuredImage;
            res.color = '#ffffff'
        } else if (mimeType.indexOf('audio') > -1) {
            res.image = './assets/img/news-audio.png';
            res.color = '#0073ff';
        } else if (mimeType.indexOf('video') > -1) {
            res.image = './assets/img/news-video.png';
            res.color = '#ffd952';
        } else if (mimeType.indexOf('image') > -1) {
            res.image = './assets/img/news-picture.png';
            res.color = '#ff5766';
        } else {
            res.image = './assets/img/news-letter.png';
            res.color = '#26d87d';
        }

        //console.log(mimeType, featuredImage, res);
        return res;
    }
}

function loadMediaItem(data, prepend = false) {
    //console.log('Showing content', data);
    //trantor.seedFile(data.public_content, './torrents/' + data.address);
    articleLoader.load('./elements/content-item.html', function () {
        $('#content-item-').attr('onmouseenter', 'prepareArticle("' + data.address + '")').attr('id', 'content-item-' + data.address);
        if (!data.featured_image) {
            console.log('Adding torrent', data.public_content);
            torrentClient.downloadTorrent(data.address, data.public_content);
        }

        let featuredImage = getDefaultImageAndColor(data.content_type, data.featured_image);
        $('#content-item-image-').attr('src', featuredImage.image);
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

function discoverMedia() {
    loadAllMedia();
    return false;
}

function loadUserThatFollows() {
    followedList.html('');

    getUserAddress(function (userAddress) {
        trantor.database.getUserFollowing(userAddress, function (err, result) {

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

function loadUserFollows(data, prepend = false) {
    followedLoader.load('./elements/following-item.html', function () {
        let avatar = File.exist(data.avatarFile) ? data.avatarFile : 'https://api.adorable.io/avatars/40/'+ data.address;
        $('#follower-avatar-').attr('src', avatar).attr('id', 'follower-avatar-' + data.address);
        $('#follower-name-').html(data.name).attr('id', 'follower-name-' + data.address);
        $('#follower-description-').html(data.description).attr('id', 'follower-name-' + data.address);

        let item = followedLoader.html();
        if (prepend) {
            followedList.prepend(item);
        } else {
            followedList.append(item);
        }

        followedLoader.html('');
    });
}

function controlMedia() {
    console.log('Controling media');
    setInterval(function () {
        let display = $('#modal-article').css('display');
        console.log('Controling media', display);
        if (display === 'none') {
            $('#article-video').stop();
            $('#article-audio').stop();
        }
    }, 200)

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
            })
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
            $('#article-featured-image').attr('src', featuredImage.image);
            $('#article-featured-image').css('background-color', featuredImage.color);
        }

        $('#article-author-avatar').attr('src', authorAvatar);
        $('#article-author-name').html(preparedArticle.name);
        $('#article-author-web').html(preparedArticle.web || preparedArticle.user_description);
        $('#article-title').html(preparedArticle.title);
        $('#article-description').html(preparedArticle.description);
        let tags = '';
        if (preparedArticle.tags) {
            tags = JSON.parse(preparedArticle.tags);
            tags = tags.join(', ');
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

    }
}

function makeLike() {
    if (!preparedArticle.user_liked) {
        console.log('making like');
        let appStorage = FileStorage.load();
        let likeAmount = parseFloat(appStorage.getKey('action-amount'));
        getUserAddress(function (userAddress) {
            trantor.makeLike(userAddress, preparedArticle.address, likeAmount);
        });
    } else {
        console.log('User has like in this content');
    }
}

function downloadPrivateFile(contentAddress, privateFile) {
    torrentClient.downloadTorrent(contentAddress, privateFile, true);
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
                let torrent = torrentClient.getTorrent(privateTorrent);
                if (err) {
                    console.log(err);
                } else {
                    if (result[0]) {
                        if (torrent) {
                            Notifications.notify(lang.Files, lang.DownloadPending, './assets/img/wallet/icon-receive.png', 5);
                        } else {
                            torrentClient.downloadTorrent(preparedArticle.address, privateTorrent, true);
                            Notifications.notify(lang.Files, lang.DownloadFileStart, './assets/img/wallet/icon-receive.png', 5);
                        }
                    } else {
                        if (preparedArticle.price > 0) {
                            trantor.makeContentPayment(userAddress, preparedArticle.address);
                        } else {
                            torrentClient.downloadTorrent(preparedArticle.address, privateTorrent, true);
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
