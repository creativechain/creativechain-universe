
let dragDrop = require('drag-drop');

let featuredImage, privateFile, profileImage;
let tags = [];
let publishTags = [];
let editingArticle;

trantor.events.on('onStart', function () {
    setUserData();
});

trantor.events.on('onBeforeRegister', function (txBuilder, txBuffer, userReg, torrent) {
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
                        trantor.events.emit('onAfterRegister', txBuffer, userReg, torrent);
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

trantor.events.on('onBeforePublish', function (txBuffer, mediaPost) {
    trantor.client.sendRawTransaction(txBuffer.toString('hex'), function (err, result) {
        if (err) {
            console.log(err);
            handleRpcError(err);
        } else {
            clearArticleForm();
            modal.blockLoading(null, false);
            Notifications.notify(lang.ContentPublished, lang.ContentPublishedSuccessfully, './assets/img/publications1.png', 5);
            let tx = DecodedTransaction.fromHex(txBuffer.toString('hex'));
            trantor.events.emit('onAfterPublish', tx, mediaPost);
        }
    })
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
                let buzz = BUZZ.getBuzz(user.likes, user.comments, user.publications, 0);

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
                extensions: ['jpg', 'png', 'bmp', 'gif']
            }
        ],
    }, (fileNames) => {
        if(fileNames === undefined){
            console.log("No file selected");
            return;
        }
        
        featuredImage = fileNames[0];

        let fileInfo = File.fileInfo(featuredImage);
        if (fileInfo.size > FILE.FEATURED_MAX_SIZE) {
            let errorText = String.format(lang.FileExceedMaxSize, fileInfo.formatSize.human('jedec'), filesize(FILE.FEATURED_MAX_SIZE).human('jedec'));
            modal.error({
                message: errorText
            });
            featuredImage = null;
        } else {
            featuredImage = File.normalizePath(featuredImage);
            showPreviewImage(featuredImage)
        }
    })
}

function loadContentFile() {
    dialog.showOpenDialog((fileNames) => {
        if(fileNames === undefined){
            console.log("No file selected");
            return;
        }

        privateFile = fileNames[0];

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
    $('#drag-drop').html('<img id="publish-preview" src="' + featuredImage + '" width="25%" height="25%"/>' +
        '<br><br><button onclick="loadFeaturedImages()" type="button" class="btn btn-primary" translate="yes" data-target=".modal-publish">' +
        '   ' + lang.LoadOtherImage +
        '</button>' +
        '<p class="maxim-size" translate="yes">' + lang.MaximumFileSize + '</p>')
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

    console.log(title, description, featuredImage, privateFile);
    if (title.isEmpty() && description.isEmpty() && !(featuredImage || privateFile)) {
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
                        trantor.publish(userAddress, publishAddress, title, description, contentType, license,
                            publishTags, pubTorrent, prvTorrent, price, hash, pubFileSize, prvFileSize);
                    }
                };

                pubFileSize = 0;
                prvFileSize = 0;
                if (featuredImage) {
                    tasks++;
                    let bin = File.read(featuredImage, null);
                    hash = Utils.makeHash(bin);
                    console.log(hash, bin);
                    pubFileSize = File.fileInfo(featuredImage).size;
                    let destPublicPath = Constants.TORRENT_FOLDER + publishAddress + Constants.FILE_SEPARATOR;
                    fileClient.createFile(featuredImage, destPublicPath, function (publicTorrent, file) {
                        console.log('Public Torrent created!', publicTorrent);
                        let tHash = Utils.makeHash(publicTorrent.magnetURI);
                        trantor.database.putTorrent(tHash, publicTorrent.magnetURI, publicTorrent.path, file);
                        pubTorrent = publicTorrent;
                        makePost();
                    })
                }

                if (privateFile) {
                    tasks++;
                    let bin = File.read(privateFile, null);
                    hash = Utils.makeHash(bin);
                    console.log(hash, bin);
                    prvFileSize = File.fileInfo(privateFile).size;
                    if (privateFile === featuredImage) {
                        prvTorrent = pubTorrent;
                        makePost();
                    } else {
                        let destPrivatePath = Constants.TORRENT_FOLDER + publishAddress + '-p' + Constants.FILE_SEPARATOR;
                        fileClient.createFile(privateFile, destPrivatePath, function (privateTorrent, file) {
                            console.log('Private Torrent created!', privateTorrent);
                            let tHash = Utils.makeHash(privateTorrent.magnetURI);
                            trantor.database.putTorrent(tHash, privateTorrent.magnetURI, privateTorrent.path, file);

                            //Encrypt prvContent
                            if (price > 0) {
                                encryptContent(publishAddress, privateTorrent.magnetURI, function (encrypted) {
                                    if (encrypted) {
                                        prvTorrent = privateTorrent;
                                        makePost()
                                    } else {
                                        modal.hide();
                                        modal.error({
                                            message: lang.ContentNotEncrypted
                                        })
                                    }
                                });
                            } else {
                                prvTorrent = privateTorrent;
                                makePost()
                            }

                        })
                    }

                }
            };

            if (!editingArticle) {
                trantor.client.getNewAddress(function (err, result) {
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
            trantor.register(userAddress, username, email, web, description, avatarData, uiVueEditProfile.$data.profile.tags);
        };

        if (profileImage && profileImage.length > 0) {
            let destPath = Constants.TORRENT_FOLDER + userAddress + Constants.FILE_SEPARATOR;

            fileClient.createFile(profileImage, destPath, function (torrent, file) {
                console.log('Register torrent', torrent);
                onRegister(torrent);
                let tHash = Utils.makeHash(torrent.magnetURI);
                trantor.database.putTorrent(tHash, torrent.magnetURI, destPath, file);
            })
        } else {
            onRegister(null);
        }
    });

}

function blockContent(resourceAddress) {
    getUserAddress(function (userAddress) {
        trantor.makeBlock(userAddress, resourceAddress);
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
        setProfileImage(file);
        showProfileImage(profileImage);

    })
}

function clearArticleForm() {
    $('#publish-title').val('');
    $('#publish-description').val('');
    $('#publish-price').val('');
    $('#publish-content-file').val('');

    clearDragDrop();
    $('#publish-tags').tagsinput('removeAll');
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
function editArticle(article) {
    console.log('Editing article', article);
    editingArticle = article;

    $('#publish-title').val(article.title);
    $('#publish-description').val(article.description);
    $('#publish-price').val(Coin.parseCash(article.price, 'CREA').toPlainString());
    $('#publish-content-file').val(article.private_file || '');

    privateFile = article.private_file;
    featuredImage = article.featured_image;
    if (featuredImage) {
        showPreviewImage(featuredImage);
    } else {
        clearDragDrop();
    }

    let tags = article.tags;
    console.log(tags);
    tags = JSON.parse(tags);

    let publishTags = $('#publish-tags');

    publishTags.val(tags.join(', '));
    showTags(publishTags, tags);

    let license = article.license;
    let licenseId;
    switch (license) {
        case PUBLICATION.LICENSE.CCBY40:
            licenseId = 'by';
            break;
        case PUBLICATION.LICENSE.CCBYSA40:
            licenseId = 'bysa';
            break;
        case PUBLICATION.LICENSE.CCBYNC40:
            licenseId = 'bync';
            break;
        case PUBLICATION.LICENSE.CCBYND40:
            licenseId = 'bynd';
            break;
        case PUBLICATION.LICENSE.CCBYNCSA40:
            licenseId = 'byncsa';
            break;
        case PUBLICATION.LICENSE.PPBYNCSA:
            licenseId = 'ppbyncsa';
            break;
        case PUBLICATION.LICENSE.CCBYNCND40:
            licenseId = 'byncnd';
            break;
        default:
            licenseId = 'cco';
    }

    $('#' + licenseId).click();

    $('#modal-publish').modal('show');

}