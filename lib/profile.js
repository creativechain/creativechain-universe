
let userPosts = $('#user-posts');
let userPostsLoader = $('#publication-items');
let userFollowersList = $('#profile-followers-list');
let userFollowingsList = $('#profile-followings-list');
let preparedUserArticle;

trantor.events.subscribe('onStart', 'profile', function () {
    console.log('Trantor initialized!');

    setTimeout(function () {
        loadUserData();
    }, 1000);
});

trantor.events.subscribe('onAfterRegister', 'profile', function (args) {

    setTimeout(function () {
        loadUserData();
    }, 1000);
});

function showProfile() {
    loadUserData();
    showProfileView();
}
function loadUserData() {
    getUserAddress(function (userAddress) {
        loadProfileData(userAddress, true);
    });
}

/**
 *
 * @param {string} userAddress
 * @param {boolean} isUser
 */
function loadProfileData(userAddress, isUser = false) {
    console.log('loading user', userAddress, false);
    loadProfile(userAddress, isUser);
    loadAllUserMedia(userAddress);

    if (isUser) {
        loadUserFollowers(userAddress);
        loadUserFollowings(userAddress);
    }
}

/**
 *
 * @param {string} address
 * @param {boolean} isUser
 */
function loadProfile(address, isUser = false) {
    console.log('Loading profile for', address);
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
                let tags = '';

                if (user.tags && user.tags.length > 0) {
                    tags = JSON.parse(user.tags);
                    tags = linkTags(tags);
                }

                $('#user-tags').html(tags);

                $('#user-likes').html(user.likes);
                $('#user-comments').html(user.comments);
                $('#user-actions').html();
                $('#user-followers').html(user.followers);

                $('#user-name').html(user.name);
                $('#input-profile-image').attr('src', avatar);
                $('#input-user-name').val(user.name);
                $('#input-user-description').val(user.description);
                $('#input-user-email').val(user.email);
                $('#input-user-web').val(user.web);
            }
        }
    });

    if (isUser) {
        $('#user-edit-button').css('display', 'inherit');
        $('#user-donate-button').css('display', 'none');
    } else {
        $('#user-edit-button').css('display', 'none');
        $('#user-donate-button').css('display', 'inherit');
    }

    $('#user-address').html(address);
}

function loadUserFollowers(userAddress) {
    trantor.database.getFollowers(userAddress, function (err, result) {
        if (err) {
            console.log(err);
        } else if (result.length > 0) {
            userFollowersList.html(' ');
            let userFollowerLoader = $('#profile-followers');
            result.forEach(function (follower) {
                userFollowerLoader.load('./elements/user-follower-item.html', function () {

                    let avatar = resolveAvatar(follower.avatarFile, follower.follower_address);
                    $('#follower-avatar-')
                        .attr('src', avatar)
                        .attr('onclick', 'loadProfile("' + follower.follower_address + '")')
                        .attr('id', 'follower-avatar-' + follower.follower_address);
                    $('#follower-name-')
                        .html(follower.name)
                        .attr('onclick', 'loadProfile("' + follower.follower_address + '")')
                        .attr('id', 'follower-name-' + follower.follower_address);

                    $('#follower-description-').html(follower.description || follower.web).attr('id', 'follower-description-' + follower.follower_address);

                    let followButton = $('#follower-button-');
                    followButton.attr('id', 'follower-button-' + follower.follower_address)
                        .attr('onmouseenter', "followButtonEnter('follower-button-" + follower.follower_address + "', '" + follower.follower_address + "', " + follower.is_following + ")")
                        .attr('onmouseleave', "followButtonLeave('follower-button-" + follower.follower_address + "', '" + follower.follower_address + "', " + follower.is_following + ")");

                    makeFollowButton('follower-button-' + follower.follower_address, follower.is_following);

                    let followHtml = userFollowerLoader.html();
                    userFollowersList.append(followHtml);

                    userFollowerLoader.html('');
                })
            })


        }
    })
}

function loadUserFollowings(userAddress) {
    trantor.database.getFollowing(userAddress, function (err, result) {
        if (err) {
            console.log(err);
        } else if (result.length > 0) {
            userFollowingsList.html(' ');
            let userFollowingLoader = $('#profile-followings');
            result.forEach(function (follower) {
                userFollowingLoader.load('./elements/user-following-item.html', function () {

                    console.log(follower);

                    let avatar = resolveAvatar(follower.avatarFile, follower.followed_address);
                    $('#following-avatar-')
                        .attr('src', avatar)
                        .attr('onclick', 'loadProfile("' + follower.followed_address + '")')
                        .attr('id', 'following-avatar-' + follower.followed_address);
                    $('#following-name-')
                        .html(follower.name)
                        .attr('onclick', 'loadProfile("' + follower.followed_address + '")')
                        .attr('id', 'following-name-' + follower.followed_address);
                    $('#following-description-').html(follower.description || follower.web).attr('id', 'following-description-' + follower.followed_address);

                    let followButton = $('#following-button-');

                    followButton.attr('id', 'following-button-' + follower.followed_address)
                        .attr('onmouseenter', "followButtonEnter('following-button-" + follower.followed_address + "', '" + follower.followed_address + "', " + follower.is_following + ")")
                        .attr('onmouseleave', "followButtonLeave('following-button-" + follower.followed_address + "', '" + follower.followed_address + "', " + follower.is_following + ")");

                    makeFollowButton('following-button-' + follower.followed_address, follower.is_following);

                    let followHtml = userFollowingLoader.html();
                    userFollowingsList.append(followHtml);

                    userFollowingLoader.html('');
                })
            })


        }
    })
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
                //console.log(result);
                for (let x = 0; x < result.length; x++) {
                    let balance = result[x];
                    if (balance.address === address) {
                        addressBalance += parseFloat(balance.value);
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

        let avatar = resolveAvatar(data.avatarFile, data.author);
        $('#content-item-author-avatar-' + address).attr('src', avatar);
        $('#content-item-author-' + address).html(data.name);
    });

}

/**
 *
 * @param address
 * @param userAddress
 */
function prependItem(address, userAddress) {
    trantor.database.getMediaByAddress(address, function (err, result) {
        if (err) {
            console.error(err);
        } else {
            console.log(result);
            result = result[0];
            loadProfileMediaItem(result, userAddress, true)
        }
    }, userAddress)
}

function loadProfileMediaItem(data, userAddress, prepend = false) {
    console.log('Showing content', data);
    //trantor.seedFile(data.public_content, './torrents/' + data.address);
    userPostsLoader.load('./elements/content-item.html', function () {
        $('#content-item-').attr('onmouseenter', 'prepareArticle("' + data.address + '", "' + userAddress + '")').attr('id', 'content-item-' + data.address);

        let featuredImage = getDefaultImageAndColor(data.content_type, data.featured_image);
        $('#content-item-image-').css('background-image', "url('" + featuredImage.image + "')")
            .css('background-color', featuredImage.color).attr('id', 'content-item-image-' + data.address);

        $('#content-item-title-').html(data.title).attr('id', 'content-item-title-' + data.address);
        $('#content-item-description-').html(data.description).attr('id', 'content-item-description-' + data.address);
        $('#content-item-like-count-').html(data.likes).attr('id', 'content-item-like-count-' + data.address);
        $('#content-item-comments-').html(data.comments).attr('id', 'content-item-comments-' + data.address);

        let avatar = resolveAvatar(data.avatarFile, data.author);
        $('#content-item-author-avatar-').attr('src', avatar).attr('id', 'content-item-author-avatar-' + data.address);
        $('#content-item-author-').html(data.name).attr('id', 'content-item-author-' + data.address);

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

        let item = userPostsLoader.html();
        if (prepend) {
            userPosts.prepend(item);
        } else {
            userPosts.append(item);
        }

        userPostsLoader.html('');
    });
}

/**
 *
 * @param {string} authorAddress
 */
function loadAllUserMedia(authorAddress) {

    trantor.database.getMediaAddressByAuthor(authorAddress, function (err, result) {
        if (err) {
            console.error(err);
        } else {
            userPosts.html('');
            console.log(result);
            getUserAddress(function (userAddress) {
                result.forEach(function (row) {
                    prependItem(row.address, userAddress);
                })
            });

        }
    });
}