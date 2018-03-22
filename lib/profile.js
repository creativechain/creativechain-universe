
let loadedProfile;

let uiVueProfile = null;
let uiVueEditProfile = null;
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

function showUpdateUser() {
    loadProfileData(Constants.UPDATE_USER, false);
    showProfileView();
    return false;
}

function loadUserData() {
    getUserAddress(function (userAddress) {
        loadProfileData(userAddress, true);
    });
}

function updateAuthorProfile(authorAddress) {
    getUserAddress(function (userAddress) {
        if (loadedProfile === authorAddress) {
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
    console.log('loading user', profileAddress, isUser);
    loadedProfile = profileAddress;
    loadProfile(profileAddress, isUser);
    loadAllUserMedia(profileAddress);

    let onUserAddress = function (userAddress) {
        loadUserFollowers(profileAddress, userAddress);
        loadUserFollowings(profileAddress, userAddress);
        loadAllNotifications();
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
                    user.tags = JSON.parse(user.tags);

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
                                search: search,
                                makeFollowButton: makeFollowButton,
                                followButtonEnter: followButtonEnter,
                                followButtonLeave: followButtonLeave,
                                performFollow: performFollow
                            }
                        })
                    } else {
                        uiVueProfile.$data.profile = user;
                        uiVueProfile.$data.buzz = BUZZ.getBuzz(user.likes, user.comments, user.publications);
                    }

                } else {
                    user = {
                        isUser: isUser,
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
                                search: search
                            }
                        })
                    } else {
                        uiVueProfile.$data.profile = user;
                        uiVueProfile.$data.buzz = BUZZ.getBuzz(user.likes, user.comments, user.publications);
                    }

                }

                //Edit profile;

                if (isUser) {
                    setProfileImage(user.avatarFile);

                    if (!uiVueEditProfile) {
                        uiVueEditProfile = new Vue({
                            el: '#ui-profile-edit',
                            data: {
                                profile: user,
                                lang: lang,
                                tagsText: user.tags.join(', '),
                                tempAvatar: user.avatarFile,
                            },
                            methods: {
                                resolveAvatar: resolveAvatar,
                                removeTag: function (tag) {
                                    /** {Array} tags */
                                    let tags = uiVueEditProfile.$data.profile.tags;
                                    let index = tags.indexOf(tag);

                                    if (index > -1) {
                                        tags.splice(index, 1);
                                    }

                                    uiVueEditProfile.$data.tagsText = tags.join(', ');
                                },
                                /**
                                 *
                                 * @param {KeyboardEvent} e
                                 */
                                parseTags(e) {
                                    let opts = e.srcElement.attributes['data-options'].nodeValue;
                                    opts = parseOptions(opts);

                                    let val = uiVueEditProfile.$data.tagsText;
                                    let tags = val.replace(/\s/g, ',').replace(/,{2,}/g, ',').split(',');

                                    //Check char length
                                    if (opts.maxChars > 0) {
                                        for (let x = 0; x < tags.length; x++) {
                                            let t = tags[x];

                                            if (!t.isEmpty() && t.length > opts.maxChars && e.key !== ',' && e.key !== ' ') {
                                                return false;
                                            }
                                        }
                                    }

                                    let finalTags = [];
                                    for (let x = 0; x < tags.length; x++) {
                                        let t = tags[x];

                                        if (!t.isEmpty()) {
                                            if (opts.allowRepeat) {
                                                finalTags.push(t);
                                            } else if (!finalTags.includes(t)) {
                                                finalTags.push(t);
                                            }
                                        }
                                    }

                                    //Check tags length
                                    if (opts.maxTags > 0 && finalTags.length > opts.maxTags) {
                                        return false;
                                    }

                                    uiVueEditProfile.$data.profile.tags = finalTags;
                                }

                            }
                        })
                    } else {
                        uiVueEditProfile.$data.profile = user;
                    }
                }

                uiVueProfile.$forceUpdate();
                uiVueEditProfile.$forceUpdate();
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
                        loadProfileData: loadProfileData,
                        followButtonEnter: followButtonEnter,
                        followButtonLeave: followButtonLeave,
                        performFollow: performFollow,
                    }
                })
            } else {
                profileVueFollowers.$data.followers = result;
            }
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
                        loadProfileData: loadProfileData,
                        followButtonEnter: followButtonEnter,
                        followButtonLeave: followButtonLeave,
                        performFollow: performFollow
                    }
                })
            } else {
                profileVueFollowings.$data.followings = result;
            }
        }
    })
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

                articleProfileVueList.$forceUpdate();
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
                            userAddress: userAddress,
                            lang: lang
                        },
                        methods: {
                            resolveAvatar: resolveAvatar,
                            getDefaultImageAndColor: getDefaultImageAndColor,
                            getBuzz: function(user_likes, user_comments, publications, actions = 0) {
                                return BUZZ.getBuzz(user_likes, user_comments, publications, actions)
                            },
                            followButtonEnter: followButtonEnter,
                            followButtonLeave: followButtonLeave,
                            performFollow: performFollow,
                            makeLike: makeLike,
                            likeEnter: function (buttonId, liked) {
                                let icons = {
                                    NORMAL: './assets/img/like0.png',
                                    FILLED: './assets/img/like-filled.gif',
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
                                    FILLED: './assets/img/like-filled.gif',
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

function loadProfileFollows() {
    if (loadedProfile) {
        getUserAddress(function (userAddress) {
            loadUserFollowers(loadedProfile, userAddress);
            loadUserFollowings(loadedProfile, userAddress);
            loadPageNotifications();
        })
    }
}