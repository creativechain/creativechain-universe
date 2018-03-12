
let userPosts = $('#user-posts');
let userPostsLoader = $('#publication-items');
let loadedProfile;

let uiVueProfile = null;
let articleProfileVueList = null;
let profileVueFollowers = null;
let profileVueFollowings = null;

trantor.events.on('onStart', function () {
    console.log('Trantor initialized!');

    setTimeout(function () {
        loadUserData();
    }, 1000);
});

trantor.events.on('onAfterRegister', function () {
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

function updateAuthorProfile(authorAddress) {
    getUserAddress(function (userAddress) {
        if (!loadedProfile || loadedProfile === authorAddress) {
            loadProfileData(authorAddress, userAddress === authorAddress)
        }
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
                console.log(result);

                let user;
                if (result && result.length > 0) {
                    user = result[0];
                    console.log('User loaded!', user);
                    user.isUser = isUser;

                    if (!uiVueProfile) {
                        uiVueProfile = new Vue({
                            el: '#ui-profile',
                            data: {
                                profile: user,
                                lang: lang,
                                buzz: BUZZ.getBuzz(user.likes, user.comments, user.publications)
                            },
                            methods: {
                                resolveAvatar: resolveAvatar,
                            }
                        })
                    } else {
                        uiVueProfile.$data.profile = user;
                        uiVueProfile.$data.buzz = BUZZ.getBuzz(user.likes, user.comments, user.publications);
                    }

                    if (!isUser) {
                        $('#user-follow-button')
                            .unbind('click')
                            .attr('onmouseenter', "followButtonEnter('user-edit-button', '" + profileAddress + "', " + user.user_following + ")")
                            .attr('onmouseleave', "followButtonLeave('user-edit-button', '" + profileAddress + "', " + user.user_following + ")");
                        makeFollowButton('user-follow-button', user.user_following);

                        $('#user-donate-row').removeClass('hidden');
                    }

                } else {
                    user = {
                        comments: 0,
                        publications: 0,
                        likes: 0,
                        address: profileAddress,
                        tags: []
                    };

                    if (!uiVueProfile) {
                        uiVueProfile = new Vue({
                            el: '#ui-profile',
                            data: {
                                profile: user,
                                lang: lang,
                                buzz: BUZZ.getBuzz(user.likes, user.comments, user.publications)
                            },
                            methods: {
                                resolveAvatar: resolveAvatar,
                            }
                        })
                    } else {
                        uiVueProfile.$data.profile = user;
                        uiVueProfile.$data.buzz = BUZZ.getBuzz(user.likes, user.comments, user.publications);
                    }

                }

                let htmlTags = '';
                if (user.tags && user.tags.length > 0) {
                    if (typeof user.tags === 'string') {
                        htmlTags = JSON.parse(user.tags);
                    } else {
                        htmlTags = user.tags;
                    }

                    if (isUser) {
                        htmlTags.forEach(function (t) {
                            $('#input-user-tags').tagsinput('add', t);
                        });
                    }
                    htmlTags = linkTags(htmlTags);
                    $('#user-tags').html(htmlTags);
                } else {
                    $('#input-user-tags').tagsinput('removeAll');
                }
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
        } else {

            if (!profileVueFollowers) {
                profileVueFollowers = new Vue({
                    el: '#ui-profile-followers',
                    data: {
                        followers: result,
                        userAddress: userAddress,
                        lang: lang
                    },
                    methods: {
                        resolveAvatar: resolveAvatar,
                        loadProfileData: loadProfileData
                    }
                })
            } else {
                profileVueFollowers.$data.followers = result;
            }

            result.forEach(function (follower) {
                makeFollowButton('follower-button-' + follower.follower_address, follower.is_following);
            })

        }

    })
}

function loadUserFollowings(profileAddress, userAddress) {
    trantor.database.getFollowing(profileAddress, userAddress, function (err, result) {
        if (err) {
            console.log(err);
        } else {

            if (!profileVueFollowings) {
                profileVueFollowings = new Vue({
                    el: '#ui-profile-followings',
                    data: {
                        followings: result,
                        userAddress: userAddress,
                        lang: lang
                    },
                    methods: {
                        resolveAvatar: resolveAvatar,
                        loadProfileData: loadProfileData
                    }
                })
            } else {
                profileVueFollowings.$data.followings = result;
            }

            result.forEach(function (following) {
                makeFollowButton('following-button-' + following.followed_address, following.is_following);
            })

        }
    })
}

/**
 *
 * @param address
 * @param userAddress
 */
function prependUserItem(address, userAddress) {
    setTimeout(function () {
        loadProfileMediaItem(result, userAddress, true);
    }, 400);

}

function loadProfileMediaItem(data, userAddress, prepend = false) {
    //console.log('Showing content', data);
    //trantor.seedFile(data.public_content, './torrents/' + data.address);
    userPostsLoader.load(R.ELEMENT.ITEM.USER_PUBLICATION, function () {
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
        $('#content-item-like-').html(data.likes).attr('id', 'content-item-like-count-' + data.address);

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

        let item = userPostsLoader.html();
        if (prepend) {
            userPosts.prepend(item);
        } else {
            userPosts.append(item);
        }

        userPostsLoader.html('');
    });
}

function updateProfileMediaItem(address, userAddress, forceAdd = true) {
    trantor.database.getMediaByAddress(address, userAddress, function (err, result) {
        //console.log(address, result);
        if (result.length > 0) {
            let data = result[0];

            if (loadedProfile === data.author) {
                let userPosts =  articleProfileVueList.$data.userPosts;

                let added = false;
                for (let x = 0; x < userPosts.length; x++) {
                    let p = userPosts[x];
                    if (p.address === address) {
                        articleProfileVueList.$data.userPosts[x] = data;
                        added = true;
                        break;
                    }
                }

                if (!added && forceAdd) {
                    articleProfileVueList.$data.userPosts.unshift(data);
                    added = true;
                }

                if (added) {
                    let tooltipFollow = $('#content-item-tooltip-follow-' + data.address);
                    tooltipFollow.attr('onmouseenter', "followButtonEnter('content-item-tooltip-follow-" + data.address + "', '" + data.author + "', " + data.following + ")")
                        .attr('onmouseleave', "followButtonLeave('content-item-tooltip-follow-" + data.address + "', '" + data.author + "', " + data.following + ")");

                    makeFollowButton('content-item-tooltip-follow-' + data.address, data.following);

                    let icons = {
                        NORMAL: './assets/img/like0.png',
                        FILLED: './assets/img/like-filled.gif',
                        OVER: './assets/img/like-border.png',
                    };

                    makeLikeButton('content-item-like-' + address, data.user_liked, address, icons);
                }
            }
        }
    });

}

/**
 *
 * @param {string} authorAddress
 * @param {boolean} add
 */
function loadAllUserMedia(authorAddress, add = false) {
    getUserAddress(function (userAddress) {
        trantor.database.getMediaByAuthor(authorAddress, userAddress, function (err, userPublications) {
            if (err) {
                console.error(err);
            } else {
                if (!articleProfileVueList) {
                    articleProfileVueList = new Vue({
                        el: '#user-posts',
                        data: {
                            userPosts: userPublications,
                            userAddress: userAddress
                        },
                        methods: {
                            resolveAvatar: resolveAvatar,
                            getDefaultImageAndColor: getDefaultImageAndColor,
                            getBuzz: function(user_likes, user_comments, publications, actions = 0) {
                                return BUZZ.getBuzz(user_likes, user_comments, publications, actions)
                            }
                        }
                    })
                } else {

                    if (add) {
                        userPublications.forEach(function (m) {
                            articleProfileVueList.$data.userPosts.push(m);
                        });
                    } else {
                        articleProfileVueList.$data.userPosts = userPublications;
                    }
                }
            }
        });
    })
}