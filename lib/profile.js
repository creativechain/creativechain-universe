
let loadedProfile;

let uiVueProfile = null;
let uiVueEditProfile = null;
let articleProfileVueList = null;
let profileVueFollowers = null;
let profileVueFollowings = null;
let profileMediaPage = 0;

trantor.on('core.started', function () {
    console.log('Trantor initialized!');

    loadUserData();
});

trantor.on('core.register.sent', function () {
    modal.hide(true);
    loadUserData();
});


function showProfile() {
    loadUserData();
    showProfileView();
}

function showUpdateUser() {
    getUserAddress(function (userAddress) {
        loadProfileData(CONSTANTS.UPDATING_USER, userAddress === CONSTANTS.UPDATING_USER);
    });
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
    page = PAGES.PROFILE_POSTS;

    showProfileView();
    let addMedias = true;
    if (loadedProfile !== profileAddress) {
        profileMediaPage = 0;
        addMedias = false;
    }

    loadedProfile = profileAddress;
    loadProfile(profileAddress, isUser);
    loadMoreProfileMedia(profileAddress, addMedias);

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
                                buzz: BUZZ.getBuzz(user.creation_date, user.likes, user.comments, user.publications, user.followers),
                                userAddress: userAddress
                            },

                            updated: function () {
                                this.$nextTick(function () {
                                    $('#user-edit-button').html(this.lang.EditProfile);
                                    $('#user-follow-button').html(this.lang.Follow);
                                    $('#user-follow-button-following').html(this.lang.Following);
                                })
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
                        uiVueProfile.$data.userAddress = userAddress;
                        uiVueProfile.$data.buzz = BUZZ.getBuzz(user.creation_date, user.likes, user.comments, user.publications, user.followers);
                    }

                } else {
                    user = {
                        isUser: isUser,
                        comments: 0,
                        publications: 0,
                        followers: 0,
                        likes: 0,
                        creation_date: 0,
                        address: profileAddress,
                        tags: []
                    };

                    if (!uiVueProfile) {
                        uiVueProfile = new Vue({
                            el: '#ui-profile',
                            data: {
                                profile: user,
                                lang: lang,
                                buzz: BUZZ.getBuzz(user.creation_date, user.likes, user.comments, user.publications, user.followers),
                                userAddress: userAddress
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
                        uiVueProfile.$data.userAddress = userAddress;
                        uiVueProfile.$data.buzz = BUZZ.getBuzz(user.creation_date, user.likes, user.comments, user.publications, user.followers);
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

                if (!user.avatarFile || !File.exist(user.avatarFile) || File.fileInfo(user.avatarFile).size <= 0) {
                    downloadAuthorAvatar(user.address, user.avatar);
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

    trantor.dbrunner.getFollowers(profileAddress, userAddress, function (err, result) {
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
    trantor.dbrunner.getFollowing(profileAddress, userAddress, function (err, result) {
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
    trantor.dbrunner.getMediaByAddress(address, userAddress, function (err, result) {
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
                    if (!data.featured_image || !File.exist(data.featured_image)) {
                        downloadPublicFile(data.address, data.public_content)
                    }

                    if (!data.avatarFile || !File.exist(data.avatarFile)) {
                        downloadAuthorAvatar(data.author, data.avatar)
                    }
                }

                articleProfileVueList.$forceUpdate();
            }
        }
    });

}

/**
 *
 * @param {Array} userPublications
 * @param {string} userAddress
 * @param {boolean} add
 */
function showProfileMediaResults(userPublications, userAddress, add = false) {
    if (!articleProfileVueList) {
        articleProfileVueList = new Vue({
            el: '#user-posts',
            data: {
                userPosts: userPublications,
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
                getBuzz: function(user_creation_date, user_likes, user_comments, publications, followers, actions = 0) {
                    return BUZZ.getBuzz(user_creation_date, user_likes, user_comments, publications, followers, actions)
                },
                followButtonEnter: followButtonEnter,
                followButtonLeave: followButtonLeave,
                performFollow: performFollow,
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
                }
            }
        })
    } else {

        if (userPublications.length > 0) {
            userPublications.forEach(function (data) {
                //console.log('DOWNLOAD:', data.address, !data.featured_image || !File.exist(data.featured_image));
                if (!data.featured_image || !File.exist(data.featured_image)) {
                    downloadPublicFile(data.address, data.public_content)
                }

                if (!data.avatarFile || !File.exist(data.avatarFile)) {
                    downloadAuthorAvatar(data.author, data.avatar)
                }

                if (add) {
                    articleProfileVueList.$data.userPosts.push(data);
                } else {
                    articleProfileVueList.$data.userPosts = userPublications;
                }

            })
        } else {
            articleProfileVueList.$data.userPosts = userPublications;
        }

    }
}

function loadMoreProfileMedia(authorAddress, add = true) {
    profileMediaPage++;
    getUserAddress(function (userAddress) {
        trantor.dbrunner.getMediaByAuthor(authorAddress, userAddress, profileMediaPage, function (err, results) {

            if (err) {
                console.error(err);
            } else if (results.length > 0) {
                showProfileMediaResults(results, userAddress, add);
            } else {
                profileMediaPage--;
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