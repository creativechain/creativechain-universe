let blockedVueList = null;

trantor.on('core.started', function () {
    loadBlockeds();
});

trantor.on('core.block.build', function (txBuilt, data) {
    let onBlock = function () {
        signAndSendTx(txBuilt.hex, function (err, txid, signedTx) {
            if (err) {
                handleRpcError(err);
            } else {
                let dTx = DecodedTransaction.fromHex(signedTx);
                trantor.dbrunner.addFollowing(data, dTx, new Date().getTime(), function (err, result) {
                    if (err) {
                        console.error(err)
                    } else {
                        removeContent(data.followedAddress);
                        removeProfileContent(data.followedAddress);
                        $('#modal-article').modal('hide');
                        mustReloadContent = true;
                        loadMedia();
                        loadMoreProfileMedia(loadedProfile);
                        loadBlockeds();
                    }
                });
            }
        });
    };

    closeModalArticle();

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
                //showModalArticle();
            }
        }

    })

});

trantor.on('core.unblock.build', function (txbuilt, data) {
    let onUnblock = function () {

        signAndSendTx(txbuilt.hex, function (err, txid, signedTx) {
            if (err) {
                handleRpcError(err);
            } else {
                trantor.dbrunner.removeBlock(data, function (err, result) {
                    if (err) {
                        console.error(err);
                    } else {
                        loadBlockeds();
                        loadMedia();
                        trantor.emit('core.notification', '', lang.UnlockedContent, R.IMG.NOTIFICATION.PUBLICATION, 5);
                    }
                });
            }
        });
    };

    onUnblock();

});

function loadBlockeds() {
    getUserAddress(function (userAddress) {
        trantor.dbrunner.getBlocked(userAddress, function (err, result) {
            if (err) {
                console.error(err);
            } else {
                let showBlocks = function () {
                    result.forEach(function (blocked) {
                        trantor.dbrunner.getAuthor(blocked.followed_address, userAddress, function (err, data) {
                            if (err) {
                                console.error(err);
                            } else if (data.length > 0) {
                                blocked.isUser = true;
                                blocked.data = data[0];
                                blocked.avatarFile = resolveAvatar(data[0].avatarFile, data[0].address);
                                blockedVueList.$data.blockeds.push(blocked);
                            }
                        });

                        trantor.dbrunner.getBlockedMediaByAddress(blocked.followed_address, userAddress, function (err, data) {
                            if (err) {
                                console.error(err);
                            } else if (data.length > 0) {
                                blocked.isUser = false;
                                blocked.data = data[0];
                                blocked.mediaIcon = getDefaultImageAndColor(data[0].content_type, data[0].featured_image);
                                blockedVueList.$data.blockeds.push(blocked);
                            }
                        });
                    })
                };

                if (!blockedVueList) {
                    blockedVueList = new Vue({
                        el: '#blockeds-list',
                        data: {
                            blockeds: [],
                            userAddress: userAddress,
                            lang: lang
                        },
                        methods: {
                            getDefaultImageAndColor: getDefaultImageAndColor,
                            unblockContent: unblockContent,
                            loadProfileData: loadProfileData,
                            showArticle: function (address) {
                                trantor.dbrunner.getBlockedMediaByAddress(address, userAddress, function (err, data) {
                                    if (err) {
                                        console.error(err);
                                    } else if (data.length > 0) {
                                        showModalArticle();
                                        loadArticle(data, userAddress);
                                    }
                                });
                            }
                        }
                    });
                    showBlocks();
                } else {
                    blockedVueList.$data.blockeds = [];
                    showBlocks();
                }
            }
        })
    })
}

function unblockContent(contentAddress) {
    getUserAddress(function (userAddress) {
        unlockW(walletPassword, function (err, result) {
            if (err) {
                handleRpcError(err);
            } else {
                trantor.unblock(userAddress, contentAddress)
            }
        });

    })
}