
let userPosts = $('#user-posts');
let userPostsLoader = $('#publication-items');
let preparedUserArticle;

trantor.events.subscribe('onStart', 'profile', function () {
    console.log('Trantor initialized!');

    putUserData();
    loadAllUserMedia();
});

trantor.events.subscribe('onAfterRegister', 'profile', function (args) {

    setTimeout(function () {
        putUserData();
    }, 1000);
});

function putUserData() {

    let address = localStorage.getItem('userAddress');
    trantor.getUserData(address, function (err, result) {
        if (err) {
            console.error(err);
        } else {
            //console.log(result);
            if (result && result.length > 0) {
                let user = result[0];
                let buzz = BUZZ.getBuzz(user.likes, user.comments, user.publications, 0);
                let avatar = resolveAvatar(user.avatarFile, user.address, 80);

                $('#user-avatar').attr('src', avatar);
                $('#user-buzz-level-icon').attr('src', buzz.icon);
                $('#user-buzz-level').html(buzz.levelText);
                $('#user-buzz').html(buzz.rate + ' Buzz');
                $('#user-nick').html(user.name);
                $('#user-web').html(user.web);
                $('#user-description').html(user.description);
                let tags = JSON.parse(user.tags);
                tags = tags.join(', ');
                $('#user-tags').html(tags);;

                $('#user-likes').html(user.likes);
                $('#user-comments').html(user.comments);
                $('#user-actions').html();
                $('#user-followers').html(user.followers);
            }
        }


    });

    $('#user-address').html(address);

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

function prepareProfileArticle(address) {
    console.log('preparing article', address);
    trantor.database.getMediaByAddress(address, function (err, result) {
        console.log(result);
        preparedUserArticle = result[0];

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

        let authorAvatar = resolveAvatar(preparedUserArticle.avatarFile, preparedUserArticle.author, 50);

        getUserAddress(function (userAddress) {
            trantor.getUserData(userAddress, function (data) {
                data = data[0];
                let userAvatar = resolveAvatar(data.avatarFile, userAddress);
                $('#article-comment-avatar').attr('src', userAvatar);
            })
        });

        $('#article-featured-image').attr('src', preparedUserArticle.featured_image);
        $('#article-author-avatar').attr('src', authorAvatar);
        $('#article-author-name').html(preparedUserArticle.name);
        $('#article-author-web').html(preparedUserArticle.web || preparedUserArticle.user_description);
        $('#article-title').html(preparedUserArticle.title);
        $('#article-description').html(preparedUserArticle.description);
        let tags = '';
        if (preparedUserArticle.tags) {
            tags = JSON.parse(preparedUserArticle.tags);
            tags = tags.join(', ');
        }
        $('#article-tags').html(tags);
        $('#article-format').html(preparedUserArticle.content_type);
        $('#article-date').html(new Date(preparedUserArticle.creation_date).toLocaleString());
        $('#article-likes').html(preparedUserArticle.likes + ' ' + lang.Likes);
        $('#article-comments').html(preparedUserArticle.comments + ' ' + lang.Comments);

        let buzz = BUZZ.getBuzz(preparedUserArticle.user_likes, preparedUserArticle.user_comments, preparedUserArticle.publications);

        $('#article-author-level-icon').attr('src', buzz.icon);
        $('#article-author-level').html(buzz.levelText);
        $('#article-author-buzz').html(buzz.rate + ' Buzz');

        $('#article-comment-button').attr('onclick', "publishComment('" + preparedUserArticle.address + "')");
        $('#article-comment').val('');


    });
}

function updateProfileItem(address) {
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

function prependItem(address) {
    trantor.database.getMediaByAddress(address, function (err, result) {
        if (err) {
            console.error(err);
        } else {
            console.log(result);
            result = result[0];
            loadProfileMediaItem(result, true)
        }
    })
}

/**
 *
 * @param {Array} items
 * @param {boolean} prepend
 */
function loadProfileMediaItems(items, prepend = false) {
    userPosts.html('');
    if (items) {
        items.forEach(function (item) {
            loadMediaItem(item, prepend);
        })
    }
}

function loadProfileMediaItem(data, prepend = false) {
    console.log('Showing content', data);
    //trantor.seedFile(data.public_content, './torrents/' + data.address);
    userPostsLoader.load('./elements/content-item.html', function () {
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

        let item = userPostsLoader.html();
        if (prepend) {
            userPosts.prepend(item);
        } else {
            userPosts.append(item);
        }

        userPostsLoader.html('');
    });
}

function loadAllUserMedia() {

    getUserAddress(function (userAddress) {
        trantor.database.getMediaAddressByAuthor(userAddress, function (err, result) {
            if (err) {
                console.error(err);
            } else {
                userPosts.html('');
                console.log(result);
                result.forEach(function (row) {
                    prependItem(row.address);
                })
            }
        });
    });
}