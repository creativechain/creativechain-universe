
let userPosts = $('#user-posts');
let userPostsLoader = $('#publication-items');
let userFollowersList = $('#profile-followers-list');
let userFollowingsList = $('#profile-followings-list');
let loadedProfile;

trantor.events.subscribe('onStart', 'profile', function () {
    console.log('Trantor initialized!');

    setTimeout(function () {
        loadUserData();
    }, 1000);
});

trantor.events.subscribe('onAfterRegister', 'profile', function (args) {
    modal.hide(true);
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
 * @param {string} profileAddress
 * @param {boolean} isUser
 */
function loadProfileData(profileAddress, isUser = false) {
    console.log('loading user', profileAddress, false);
    loadedProfile = profileAddress;
    loadProfile(profileAddress, isUser);
    loadAllUserMedia(profileAddress);

    let onUserAddress = function (userAddress) {
        loadUserFollowers(profileAddress, userAddress);
        loadUserFollowings(profileAddress, userAddress);
    };

    if (isUser) {
        onUserAddress(profileAddress);
        $('#ui-profile-filter-notifications').removeClass('hidden');
    } else {
        getUserAddress(function (userAddress) {
            onUserAddress(userAddress);
        });
        $('#ui-profile-filter-notifications').addClass('hidden');
    }

}

/**
 *
 * @param {string} profileAddress
 * @param {boolean} isUser
 */
function loadProfile(profileAddress, isUser = false) {
    console.log('Loading profile for', profileAddress, isUser);
    let onUserAddress = function (userAddress) {
        trantor.getUserData(profileAddress, userAddress, function (err, result) {
            if (err) {
                console.error(err);
            } else {
                //console.log(result);

                let onProfile = function (name, avatar, email, description, web, tags, followers, likes, comments, publications) {

                    $('#user-nick').html(name);
                    $('#user-avatar').attr('src', avatar);
                    $('#input-profile-image').attr('src', avatar);
                    $('#user-name').html(name);
                    $('#input-user-name').val(name);
                    $('#input-user-description').val(description);
                    $('#input-user-email').val(email);
                    $('#input-user-web').val(web);
                    $('#user-web').html(web);
                    $('#user-description').html(description);

                    let htmlTags = '';
                    if (tags && tags.length > 0) {
                        htmlTags = JSON.parse(tags);
                        if (isUser) {
                            htmlTags.forEach(function (t) {
                                $('#input-user-tags').tagsinput('add', t);
                            });
                        }
                        htmlTags = linkTags(htmlTags);
                    } else {
                        htmlTags = '';
                        $('#input-user-tags').tagsinput('removeAll');
                    }

                    $('#user-tags').html(htmlTags);
                    $('#user-likes').html(likes);
                    $('#user-comments').html(comments);
                    $('#user-actions').html();
                    $('#user-followers').html(followers);

                    let buzz = BUZZ.getBuzz(likes, comments, publications, 0);
                    $('#user-buzz-level-icon').attr('src', buzz.icon);
                    $('#user-buzz-level').html(buzz.levelText);
                    $('#user-buzz').html(buzz.rate + ' Buzz');
                };

                if (result && result.length > 0) {
                    let user = result[0];

                    let avatar = resolveAvatar(user.avatarFile, user.address);
                    let name = user.name || lang.Anonymous;
                    onProfile(name, avatar, user.email, user.description, user.web, user.tags, user.followers, user.likes,
                        user.comments, user.publications);

                    if (isUser) {
                        $('#user-edit-button')
                            .html(lang['Edit profile'])
                            .unbind('click')
                            .attr('onclick', "return showProfileEditView()")
                            .attr('class', "btn btn-therciary")
                            .removeAttr('onmouseenter')
                            .removeAttr('onmouseleave')
                            .removeClass('hidden');
                        $('#user-donate-row').addClass('hidden');
                    } else {
                        $('#user-edit-button')
                            .unbind('click')
                            .attr('onmouseenter', "followButtonEnter('user-edit-button', '" + profileAddress + "', " + user.user_following + ")")
                            .attr('onmouseleave', "followButtonLeave('user-edit-button', '" + profileAddress + "', " + user.user_following + ")");
                        makeFollowButton('user-edit-button', user.user_following);

                        $('#user-donate-row').removeClass('hidden');
                    }

                } else {
                    let avatar = resolveAvatar(null, profileAddress);
                    onProfile(lang.Anonymous, avatar, '', '', '', [], 0, 0, 0, 0);
                }



                $('#user-address').html(profileAddress);
            }


        });


    };

    if (isUser) {
        onUserAddress(profileAddress);
    } else {
        getUserAddress(function (userAddress) {
            onUserAddress(userAddress);
        })
    }

}

function loadUserFollowers(profileAddress, userAddress) {

    trantor.database.getFollowers(profileAddress, userAddress, function (err, result) {
        if (err) {
            console.log(err);
        } else if (result.length > 0) {
            userFollowersList.html(' ')
                .removeClass('hidden');
            $('#ui-no-followers').addClass('hidden');
            let userFollowerLoader = $('#profile-followers');
            result.forEach(function (follower) {
                userFollowerLoader.load('./elements/user-follower-item.html', function () {
                    let isUser = follower.follower_address === userAddress;
                    let avatar = resolveAvatar(follower.avatarFile, follower.follower_address);
                    $('#follower-avatar-')
                        .attr('src', avatar)
                        .attr('onclick', "loadProfileData('" + follower.follower_address + "', " + isUser + ")")
                        .attr('id', 'follower-avatar-' + follower.follower_address);
                    $('#follower-name-')
                        .html(follower.name || lang.Anonymous)
                        .attr('onclick', "loadProfileData('" + follower.follower_address + "', " + isUser + ")")
                        .attr('id', 'follower-name-' + follower.follower_address);

                    $('#follower-description-').html(follower.description || follower.web || '-').attr('id', 'follower-description-' + follower.follower_address);

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
        } else {
            userFollowersList.addClass('hidden');
            $('#ui-no-followers').removeClass('hidden');
        }
    })
}

function loadUserFollowings(profileAddress, userAddress) {
    trantor.database.getFollowing(profileAddress, userAddress, function (err, result) {
        if (err) {
            console.log(err);
        } else if (result.length > 0) {
            userFollowingsList.html(' ')
                .removeClass('hidden');
            $('#ui-no-followings').addClass('hidden');
            let userFollowingLoader = $('#profile-followings');
            result.forEach(function (follower) {
                userFollowingLoader.load('./elements/user-following-item.html', function () {

                    let isUser = follower.followed_address === userAddress;

                    let avatar = resolveAvatar(follower.avatarFile, follower.followed_address);
                    $('#following-avatar-')
                        .attr('src', avatar)
                        .attr('onclick', "loadProfileData('" + follower.followed_address + "', " + isUser + ")")
                        .attr('id', 'following-avatar-' + follower.followed_address);
                    $('#following-name-')
                        .html(follower.name || lang.Anonymous)
                        .attr('onclick', "loadProfileData('" + follower.followed_address + "', " + isUser + ")")
                        .attr('id', 'following-name-' + follower.followed_address);
                    $('#following-description-').html(follower.description || follower.web || '-').attr('id', 'following-description-' + follower.followed_address);

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
        } else {
            userFollowingsList.addClass('hidden');
            $('#ui-no-followings').removeClass('hidden');
        }
    })
}

/**
 *
 * @param address
 * @param userAddress
 */
function prependItem(address, userAddress) {
    setTimeout(function () {
        trantor.database.getMediaByAddress(address, userAddress, function (err, result) {
            if (err) {
                console.error(err);
            } else if (result.length > 0) {
                //console.log(result);
                result = result[0];
                loadProfileMediaItem(result, userAddress, true)
            }
        });
    }, 400);

}

function loadProfileMediaItem(data, userAddress, prepend = false) {
    console.log('Showing content', data);
    //trantor.seedFile(data.public_content, './torrents/' + data.address);
    userPostsLoader.load('./elements/content-item.html', function () {
        $('#content-item-').attr('onmouseenter', 'prepareArticle("' + data.address + '", "' + userAddress + '")')
            .attr('id', 'content-item-' + data.address)
            .removeClass('col-lg-3')
            .addClass('col-lg-4');

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
        $('#content-item-image-').css('background-image', "url('" + featuredImage.image + "')")
            .css('background-color', featuredImage.color).attr('id', 'content-item-image-' + data.address);

        $('#content-item-title-').html(data.title).attr('id', 'content-item-title-' + data.address);
        $('#content-item-description-').html(data.description).attr('id', 'content-item-description-' + data.address);
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
            //console.log(result);
            getUserAddress(function (userAddress) {
                result.forEach(function (row) {
                    prependItem(row.address, userAddress);
                })
            });

        }
    });
}