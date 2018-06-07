
let dragDrop = require('drag-drop');

let featuredImage, privateFile, profileImage;
let tags = [];

let editingArticle;
let publishModal = null;

trantor.on('core.started', function () {
    setUserData();

    publishModal = $('#modal-publish');
    publishModal.on('hidden.bs.modal', function () {
        if (editingArticle) {
            clearArticleForm();
            editingArticle = null;
        }
    });
});

trantor.on('core.register.build', function (txBuilder, txBuffer, userReg, torrent) {
    console.log('Event onBeforeRegister', txBuffer.toString('hex'));

    let fee = Coin.parseCash(txBuilder.txFee, 'CREA');

    let feeMessage = String.format(lang.ActionCommission, fee.toString());

    modal.alert({
        title: lang.Register,
        message: feeMessage,
        ok: {
            text: lang.Ok,
            onclick: function () {
                modal.hide(true);
                modal.loading();
                trantor.sendRawTransaction(txBuffer.toString('hex'), function (err, result) {
                    if (!err) {
                        trantor.emit('core.register.sent', txBuffer, userReg, torrent);
                        modal.hide();
                        editingArticle = null;
                    } else {
                        handleRpcError(err, true);
                    }
                });
            }
        },
        cancel: {
            text: lang.Cancel,
            onclick: function () {
                modal.hide(true);
            }
        }
    })

});

trantor.on('core.publication.build', function (txBuffer, mediaPost, txBuilder) {

    let title = editingArticle ? lang.Edition : lang.Publication;
    let fee = Coin.parseCash(txBuilder.txFee, 'CREA');

    modal.alert({
        title: title,
        message: String.format(lang.PublishContent, fee.toFriendlyString()),
        ok: {
            onclick: function () {
                sendTransaction(txBuffer.toString('hex'), walletPassword, function (err, result) {
                    if (err) {
                        console.log(err);
                        handleRpcError(err);
                    } else {
                        clearArticleForm();
                        modal.blockLoading(null, false);
                        editingArticle = null;
                        let tx = DecodedTransaction.fromHex(txBuffer.toString('hex'));
                        trantor.emit('core.publication.sent', tx, mediaPost);
                        trantor.emit('core.notification', lang.ContentPublished, lang.ContentPublishedSuccessfully, './assets/img/publications1.png', 5);
                    }
                });
            }
        },
        cancel: {
            onclick: function () {
                showPublishForm();
            }
        }
    });
});

function setUserData() {
    getUserAddress(function (userAddress) {
        trantor.getUserData(userAddress, userAddress, function (err, results) {
            if (err) {
                console.error(err);
            } else if (results && results.length > 0) {
                let user = results[0];
                //console.log(user);
                let avatar = resolveAvatar(user.avatarFile, userAddress);
                let buzz = BUZZ.getBuzz(user.creation_date, user.likes, user.comments, user.publications, user.followers);

                $('#user-publish-name').html(user.name);
                $('#user-publish-web').html(user.web || user.description);
                $('#user-publish-avatar').attr('src', avatar);
                $('#user-publish-level-icon').attr('src', buzz.icon);
                $('#user-publish-level').html(buzz.levelText);
                $('#user-publish-buzz').html(buzz.rate + ' Buzz');
            }
        })
    });
}

function prepareDragDrop() {
    dragDrop('#drag-drop', function (files) {
        console.log(files);
        featuredImage = files[0].path;
        featuredImage = File.normalizePath(featuredImage);
        showPreviewImage(featuredImage);
    });
}

function loadFeaturedImages() {
    dialog.showOpenDialog(null, {
        title: lang['ChoosePreviewImage'],
        filters: [
            {
                name: lang['ImagesFiles'],
                extensions: ['jpg', 'jpeg', 'png', 'bmp', 'gif']
            }
        ],
    }, (fileNames) => {
        if(fileNames === undefined){
            console.log("No file selected");
            return;
        }

        featuredImage = File.normalizePath(fileNames[0]);

        showPreviewImage(featuredImage)
    })
}

function loadContentFile() {
    dialog.showOpenDialog((fileNames) => {
        if(fileNames === undefined){
            console.log("No file selected");
            return;
        }

        privateFile = File.normalizePath(fileNames[0]);

        let fileInfo = File.fileInfo(privateFile);
        if (fileInfo.size > FILE.PRIVATE_MAX_SIZE) {
            let errorText = String.format(lang.FileExceedMaxSize, fileInfo.formatSize.human('jedec'), filesize(FILE.PRIVATE_MAX_SIZE).human('jedec'));
            modal.error({
                message: errorText
            });
            privateFile = null;
        } else {
            privateFile = File.normalizePath(privateFile);
            $('#publish-content-file').val(privateFile);
        }

    })
}

function showPreviewImage(featuredImage) {

    if (featuredImage) {
        let fileInfo = File.fileInfo(featuredImage);
        if (fileInfo.size > FILE.FEATURED_MAX_SIZE) {
            let errorText = String.format(lang.FileExceedMaxSize, fileInfo.formatSize.human('jedec'), filesize(FILE.FEATURED_MAX_SIZE).human('jedec'));
            modal.error({
                message: errorText
            });
            featuredImage = null;
        } else {
            featuredImage = File.normalizePath(featuredImage);
            $('#drag-drop').html('<img id="publish-preview" src="' + featuredImage + '" width="25%" height="25%"/>' +
                '<br><br><button onclick="loadFeaturedImages()" type="button" class="btn btn-primary" translate="yes" data-target=".modal-publish">' +
                '   ' + lang.LoadOtherImage +
                '</button>' +
                '<p class="maxim-size" translate="yes">' + lang.MaximumPublicSize + '</p>' +
                '<p class="maxim-size" translate="yes">' + lang.PreviewImageIsAccessible + '</p>')
        }
    }

}

/**
 *
 * @return {Number}
 */
function getLicense() {
    let checked = $('input[name=publish-license]:checked').val();
    return parseInt(checked);
}

/**
 * @param {string} file
 */
function mimeType(file) {
    let mimeType = Mime.lookup(file);
    if (mimeType) {
        return mimeType;
    }

    return '*/*';
}

function publishContent() {

    let title = removeHtml($('#publish-title').val()) || '';
    let description = removeHtml($('#publish-description').val()) || '';
    let publishTags = removeHtml($('#publish-tags').val());
    publishTags = publishTags.replace(/\s/g, ',').replace(/,{2,}/g, ',').split(',');

    console.log(title, description, featuredImage, privateFile);
    if (title.isEmpty() || description.isEmpty() || !(featuredImage || privateFile)) {
        modal.error({
            message: lang.PublicationIncomplete
        })
    } else {
        modal.blockLoading(lang.Publishing, true);
        let price = $('#publish-price').val().replace(',', '.');
        price = parseFloat(price) ? parseFloat(price) : 0;
        price += 0.000000001;
        price = Coin.parseCash(price, 'CREA').amount;
        let license = getLicense();
        let contentType = mimeType(privateFile || featuredImage);

        getUserAddress(function (userAddress) {

            let publishAddress;

            let onMakePublish = function () {

                let pubTorrent, prvTorrent, prvFileSize, pubFileSize;
                let tasks = 0;
                let hash = "";
                let makePost = function () {
                    tasks--;
                    if (tasks === 0) {
                        unlockW(walletPassword, function (err, result) {
                            if (err) {
                                handleRpcError(err);
                            } else {
                                trantor.publish(userAddress, publishAddress, title, description, contentType, license,
                                    publishTags, pubTorrent, prvTorrent, price, hash, pubFileSize, prvFileSize);
                            }

                        });

                    }
                };

                pubFileSize = 0;
                prvFileSize = 0;
                if (featuredImage) {
                    tasks++;

                    if (File.exist(featuredImage)) {
                        let bin = File.read(featuredImage, null);
                        hash = Utils.makeHash(bin);
                        console.log(hash, bin);
                        pubFileSize = File.fileInfo(featuredImage).size;

                        trantor.ipfsrunner.createFile(featuredImage, function (error, file, ipfsData) {
                            console.log('Public Torrent created!', file, ipfsData);
                            let tHash = Utils.makeHash(ipfsData.CID);
                            trantor.dbrunner.putTorrent(tHash, ipfsData.CID, ipfsData.path, file);
                            pubTorrent = ipfsData;
                            makePost();
                        });
                    } else {
                        pubTorrent = ipfsData;
                        makePost();
                    }

                }

                if (privateFile) {
                    tasks++;

                    if (File.exist(privateFile)) {
                        let bin = File.read(privateFile, null);
                        hash = Utils.makeHash(bin);
                        console.log(hash, bin);
                        prvFileSize = File.fileInfo(privateFile).size;
                        if (privateFile === featuredImage) {
                            prvTorrent = pubTorrent;
                            makePost();
                        } else {
                            trantor.ipfsrunner.createFile(privateFile, function (error, file, ipfsData) {
                                console.log('Private Torrent created!', ipfsData);
                                let tHash = Utils.makeHash(ipfsData.CID);
                                trantor.dbrunner.putTorrent(tHash, ipfsData.CID, ipfsData.path, file);

                                //Encrypt prvContent
                                if (price > 0) {
                                    encryptContent(publishAddress, ipfsData.CID, function (encrypted) {
                                        console.log('Encrypted data: ', encrypted);
                                        if (encrypted) {
                                            prvTorrent = {
                                                CID: encrypted.data
                                            };
                                            makePost()
                                        } else {
                                            modal.hide();
                                            modal.error({
                                                message: lang.ContentNotEncrypted
                                            })
                                        }
                                    });
                                } else {
                                    prvTorrent = ipfsData;
                                    makePost()
                                }

                            });
                        }
                    } else {
                        prvTorrent = privateFile;
                        makePost()
                    }
                }
            };

            if (!editingArticle) {
                trantor.rpcWallet.getNewAddress(function (err, result) {
                    if (err) {
                        console.error(err);
                        modal.error({
                            message: err
                        })
                    } else {
                        //console.log(result);
                        modal.blockLoading(lang.Publishing);
                        publishAddress = result;
                        onMakePublish();
                    }
                })
            } else {
                publishAddress = editingArticle.address;
                onMakePublish();
            }
        });
    }

}

function register() {
    let username = removeHtml(uiVueEditProfile.$data.profile.name);
    let description = removeHtml(uiVueEditProfile.$data.profile.description);
    let email = removeHtml(uiVueEditProfile.$data.profile.email);
    let web = removeHtml(uiVueEditProfile.$data.profile.web);

    getUserAddress(function (userAddress) {

        let onRegister = function (avatarData) {
            unlockW(walletPassword, function (err, result) {
                if (err) {
                    handleRpcError(err);
                } else {
                    trantor.register(userAddress, username, email, web, description, avatarData, uiVueEditProfile.$data.profile.tags);
                }

            });
        };

        if (profileImage && profileImage.length > 0) {
            let destPath = CONSTANTS.DATA_DIR + userAddress + '/';

            trantor.ipfsrunner.createFile(profileImage, function (error, file, ipfsData) {
                console.log('Register torrent', ipfsData);
                onRegister(ipfsData);
                let tHash = Utils.makeHash(ipfsData.CID);
                trantor.dbrunner.putTorrent(tHash, ipfsData.CID, destPath, file);
            });
        } else {
            onRegister(null);
        }
    });

}

function blockContent(resourceAddress) {
    getUserAddress(function (userAddress) {
        unlockW(walletPassword, function (err, result) {
            if (err) {
                handleRpcError(err);
            } else {
                trantor.block(userAddress, resourceAddress);
            }
        });

    })
}

function onTagsChange(event) {
    console.log(event)
    tags = $('#input-user-tags').tagsinput('items');

    /** {string} tagsVal */
    let tagsVal = $('#publish-tags').val().toString();
    publishTags = tagsVal.replace(' ', ',').split(',');

    let publishTagsList = $('#publish-tags-list');
    publishTagsList.html('');


    publishTags.forEach(function (tag) {
        if (!tag.isEmpty()) {
            publishTagsList.append(
                `<button type="button" class="btn btn-primary button-tag-publish" translate="yes">
                    ${tag}
                    <span class="glyphicon glyphicon-remove" aria-hidden="true"></span>
                 </button>`
            )
        }
    })
}

function showProfileImage(file) {
    uiVueEditProfile.$data.tempAvatar = file;
}

function setProfileImage(file) {
    profileImage = file;
}

function loadProfileImage() {
    dialog.showOpenDialog(null, {
        title: lang['ChooseProfileImage'],
        filters: [
            {
                name: lang['ImagesFiles'],
                extensions: ['jpg', 'png', 'bmp', 'gif']
            }
        ],
    }, (fileNames) => {
        if(fileNames === undefined){
            console.log("No file selected");
            return;
        }

        let file = File.normalizePath(fileNames[0]);

        let fileInfo = File.fileInfo(file);
        if (fileInfo.size > FILE.AVATAR_MAX_SIZE) {
            let errorText = String.format(lang.FileExceedMaxSize, fileInfo.formatSize.human('jedec'), filesize(FILE.AVATAR_MAX_SIZE).human('jedec'));
            modal.error({
                message: errorText
            });
            setProfileImage(null);
            showProfileImage(null);
        } else {
            setProfileImage(file);
            showProfileImage(profileImage);
        }
    })
}

function clearArticleForm() {
    $('#publish-title').val('');
    $('#publish-description').val('');
    $('#publish-price').val('');
    $('#publish-content-file').val('');

    clearDragDrop();
    let tagsInput = $('#publish-tags').val('');
    showTags(tagsInput, []);
    privateFile = null;
    featuredImage = null;
}

function clearDragDrop() {
    $('#drag-drop').html('                                    <button type="button" class="close" data-dismiss="modal" aria-label="Close">\n' +
        '                                        <span aria-hidden="true">×</span>\n' +
        '                                    </button>\n' +
        '                                    <ul class="list-inline list-unstyled">\n' +
        '                                        <li><span class="icon-plus">+</span></li>\n' +
        '                                        <li><p translate="yes">' + lang["DragFeaturedImage" ] + '</p></li>\n' +
        '                                    </ul>\n' +
        '                                    <p translate="yes">o</p>\n' +
        '                                    <button onclick="loadFeaturedImages()" type="button" class="btn btn-primary" translate="yes" data-target=".modal-publish">\n' +
        '                                       ' + lang.LoadFile +
        '                                    </button>\n' +
        '                                    <p class="maxim-size" translate="yes">' + lang.MaximumFileSize + '</p>')
}

function showPublishForm() {
    publishModal.modal('show');
}

function editArticle(article) {
    console.log('Editing article', article);
    editingArticle = article;

    $('#publish-title').val(editingArticle.title);
    $('#publish-description').val(editingArticle.description);
    $('#publish-price').val(Coin.parseCash(editingArticle.price, 'CREA').toPlainString());
    $('#publish-content-file').val(editingArticle.private_file || '');

    privateFile = editingArticle.private_file || editingArticle.private_content;
    featuredImage = editingArticle.featured_image || editingArticle.public_content;
    if (featuredImage) {
        showPreviewImage(featuredImage);
    } else {
        clearDragDrop();
    }

    let tags = editingArticle.tags;
    console.log(tags);
    tags = JSON.parse(tags);

    let publishTags = $('#publish-tags');

    publishTags.val(tags.join(', '));
    showTags(publishTags, tags);

    let license = editingArticle.license;
    let licenseId;
    switch (license) {
        case TrantorConstants.LICENSE.CCBY40:
            licenseId = 'by';
            break;
        case TrantorConstants.LICENSE.CCBYSA40:
            licenseId = 'bysa';
            break;
        case TrantorConstants.LICENSE.CCBYNC40:
            licenseId = 'bync';
            break;
        case TrantorConstants.LICENSE.CCBYND40:
            licenseId = 'bynd';
            break;
        case TrantorConstants.LICENSE.CCBYNCSA40:
            licenseId = 'byncsa';
            break;
        case TrantorConstants.LICENSE.PPBYNCSA:
            licenseId = 'ppbyncsa';
            break;
        case TrantorConstants.LICENSE.CCBYNCND40:
            licenseId = 'byncnd';
            break;
        default:
            licenseId = 'cco';
    }

    $('#' + licenseId).click();
    showPublishForm();
}