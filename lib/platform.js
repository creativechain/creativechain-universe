
let articleList = $('#content-list');
let followedList = $('#following-list');
let articleLoader = $('#publication-items');
let followedLoader = $('#follows-items');

let preparedArticle;
let onSearch = false;

trantor.events.subscribe('onStart', 'main', function () {
    console.log('onStart');
    init();
});

trantor.events.subscribe('onExploreProgress', 'main', function (args) {
    let total = args[0];
    let current = parseInt(args[1]);
    console.log(total, current, (current * 100 / total) + '%')
});

trantor.events.subscribe('onExploreFinish', 'main', function (blockCount) {
    console.log('Trantor exploration process finished');
    loadUserThatFollows();
    loadAllMedia();
    blockCount = blockCount[0];
    setTimeout(function () {
        trantor.explore(blockCount);
    }, 60 * 1000);
});

trantor.events.subscribe('onDataFound', 'main', function (args) {
    let tx = args[0];
    let data = args[1];
    let blockTime = args[2];

    console.log('Data found', tx, data, blockTime);

    switch (data.type) {
        case PUBLICATION.TYPE.USER:
            try {
                trantor.downloadTorrent(data.address, data.avatar, false);
            } catch (err) {
                console.log(err);
            }
            trantor.database.addAuthor(data, tx, blockTime, function () {
                refreshUserData();
            });
            break;
        case PUBLICATION.TYPE.CONTENT:
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

    }

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
    })
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
    })
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
    })
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
    })
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

                })
            })
        }
    }
});

/**
 *
 * @param {DecodedTransaction} tx
 */
trantor.events.subscribe('onAfterTransactionSend', 'main',function (tx) {
    Notifications.notify(lang['TransactionSend'], tx.hash, './assets/img/wallet-alert.png', 2);
});

trantor.events.subscribe('onTorrentDownloaded', 'main', function (args) {
    console.log('Torrent available', args);
    let address = args[0];
    let torrent = args[1];
    updateItem(address);
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

function loadMediaItem(data, prepend = false) {
    //console.log('Showing content', data);
    //trantor.seedFile(data.public_content, './torrents/' + data.address);
    articleLoader.load('./elements/content-item.html', function () {
        $('#content-item-').attr('onmouseenter', 'prepareArticle("' + data.address + '")').attr('id', 'content-item-' + data.address);
        $('#content-item-image-').attr('src', data.featured_image).attr('id', 'content-item-image-' + data.address);
        $('#content-item-title-').html(data.title).attr('id', 'content-item-title-' + data.address);
        $('#content-item-description-').html(data.description).attr('id', 'content-item-description-' + data.address);
        $('#content-item-like-count-').html(data.likes).attr('id', 'content-item-like-count-' + data.address);
        $('#content-item-comments-').html(data.comments).attr('id', 'content-item-comments-' + data.address);

        let avatar = File.exist(data.avatarFile) ? data.avatarFile : 'https://api.adorable.io/avatars/40/'+ data.author;
        $('#content-item-author-avatar-').attr('src', avatar).attr('id', 'content-item-author-avatar-' + data.address);
        $('#content-item-author-').html(data.name).attr('id', 'content-item-author-' + data.address);

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

function loadAllMedia() {
    if (!onSearch) {
        trantor.database.getAllMedia(function (err, result) {
            articleList.html('');
            result.forEach(function (row) {
                loadMediaItem(row);
            })
        });
    }
}

function loadUserThatFollows() {
    followedList.html('');
    let userAddress = localStorage.getItem('userAddress');
    trantor.database.getUserFollowing(userAddress, function (err, result) {

        if (err) {
            console.error('Error', err);
        } else {
            //console.log(result);
            result.forEach(function (user) {
                loadUserFollows(user, true);
            })
        }

    })
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

function prepareArticle(address) {
    console.log('preparing article', address);
    trantor.database.getMediaByAddress(address, function (err, result) {
        console.log(result);
        preparedArticle = result[0];

        setTimeout(function () {
            loadComments(address);
        }, 10);

        trantor.client.listReceivedByAddress(0, function (err, result) {
            let addressBalance = 0.0;
            if (err) {
                console.error(err);
            } else {
                result = result.result;
                for (let x = 0; x < result.length; x++) {
                    let balance = result[x];
                    if (balance.address === address) {
                        addressBalance += parseFloat(balance.amount);
                    }
                }


                let balance = Coin.parseCash(addressBalance, 'CREA');
                $('#article-crea').html(balance.toFriendlyString())
            }
        });

        let userAvatar = resolveAvatar(preparedArticle.avatarFile, preparedArticle.author, 50);
        $('#article-featured-image').attr('src', preparedArticle.featured_image);
        $('#article-comment-avatar').attr('src', userAvatar);
        $('#article-author-avatar').attr('src', userAvatar);
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
        $('#article-date').html(new Date(preparedArticle.creation_date).toLocaleString());
        $('#article-likes').html(preparedArticle.likes + ' ' + lang.Likes);
        $('#article-comments').html(preparedArticle.comments + ' ' + lang.Comments);

        let buzz = BUZZ.getBuzz(preparedArticle.user_likes, preparedArticle.user_comments, preparedArticle.publications);

        $('#article-author-level-icon').attr('src', buzz.icon);
        $('#article-author-level').html(buzz.levelText);
        $('#article-author-buzz').html(buzz.rate + ' Buzz');

        $('#article-comment-button').attr('onclick', "publishComment('" + preparedArticle.address + "')");
        $('#article-comment').val('');


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
        let userAddress = localStorage.getItem('userAddress');
        trantor.makeComment(userAddress, contentAddress, comment);
    }
}

function makeLike() {
    if (!preparedArticle.user_liked) {
        console.log('making like');
        let appStorage = FileStorage.load();
        let likeAmount = parseFloat(appStorage.getKey('action-amount'));
        let userAddress = localStorage.getItem('userAddress');
        trantor.makeLike(userAddress, preparedArticle.address, likeAmount);
    } else {
        console.log('User has like in this content');
    }
}
