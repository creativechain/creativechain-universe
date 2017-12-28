
let dragDrop = require('drag-drop');

let featuredImage, privateFile, profileImage;
let tags = [];
let publishTags = [];

trantor.events.subscribe('onStart', 'public', function () {
    setUserData();
});

trantor.events.subscribe('onBeforeRegister', 'public', function (args) {
    let txBuffer = args[0];
    let userReg = args[1];
    let torrent = args[2];
    console.log('Event onBeforeRegister', txBuffer.toString('hex'));
    trantor.sendRawTransaction(txBuffer.toString('hex'), function (err, result) {
        if (!err) {
            trantor.events.notify('onAfterRegister', 10, txBuffer, userReg, torrent);
        } else {
            console.error(err);
            modal.error({
                message: err.message
            })
        }
    });

});

trantor.events.subscribe('onBeforePublish', 'public', function (args) {
    let txBuffer = args[0];
    let mediaPost = args[1];

    trantor.client.sendRawTransaction(txBuffer.toString('hex'), function (err, result) {
        if (err) {
            console.log(err);
        } else {
            clearArticleForm();
            Notifications.notify(lang.ContentPublished, lang.ContentPublishedSuccessfully, './assets/img/publications1.png', 5);
            let tx = DecodedTransaction.fromHex(txBuffer.toString('hex'));
            trantor.events.notify('onAfterPublish', 10, tx, mediaPost);
        }
    })
});

trantor.events.subscribe('onDeSeedFile', 'public', function (args) {
    let torrent = args[0];
    torrentClient.remove(torrent, function (err) {
        console.log('Torrent deleted!', torrent);
    })
});

function setUserData() {
    getUserAddress(function (userAddress) {
        trantor.getUserData(userAddress, function (err, results) {
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
            let errorText = String.format(lang.FileExceedMaxSize, fileInfo.formatSize.human('jedec'), filesize(FILE.FEATURED_MAX_SIZE).human('jedec'))
            modal.error({
                message: errorText
            });
            featuredImage = null;
        } else {
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
            let errorText = String.format(lang.FileExceedMaxSize, fileInfo.formatSize.human('jedec'), filesize(FILE.PRIVATE_MAX_SIZE).human('jedec'))
            modal.error({
                message: errorText
            })
            privateFile = null;
        } else {
            $('#publish-content-file').val(privateFile);
        }

    })
}

function showPreviewImage(featuredImage) {
    $('#drag-drop').html('<img src="' + featuredImage + '" width="25%" height="25%"/>' +
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
    console.log(checked);
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
    modal.loading();

    let title = removeHtml($('#publish-title').val());
    let description = removeHtml($('#publish-description').val());
    let price = $('#publish-price').val();
    price = price || 0;
    price = Coin.parseCash(price, 'CREA').value;
    let license = getLicense();
    let contentType = mimeType(privateFile || featuredImage);

    getUserAddress(function (userAddress) {
        trantor.client.getNewAddress(function (err, result) {
            if (err) {
                console.error(err);
                modal.error({
                    message: err
                })
            } else {
                //console.log(result);
                let publishAddress = result;
                let pubTorrent, prvTorrent, prvFileSize, pubFileSize;
                let tasks = 0;
                let hash;
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
                    let bin = File.read(featuredImage, 'hex');
                    bin = Buffer.from(bin, 'hex');
                    hash = Utils.makeHash(bin);
                    pubFileSize = File.fileInfo(featuredImage).size;
                    let destPublicPath = Constants.TORRENT_FOLDER + publishAddress + Constants.FILE_SEPARATOR;
                    torrentClient.createTorrent(featuredImage, destPublicPath, function (publicTorrent, file) {
                        console.log('Public Torrent created!', publicTorrent);
                        let tHash = Utils.makeHash(publicTorrent.magnetURI);
                        trantor.database.putTorrent(tHash, publicTorrent.magnetURI, publicTorrent.path, file);
                        pubTorrent = publicTorrent;
                        makePost();
                    })
                }

                if (privateFile) {
                    tasks++;
                    let bin = File.read(privateFile, 'hex');
                    bin = Buffer.from(bin, 'hex');
                    hash = Utils.makeHash(bin);
                    prvFileSize = File.fileInfo(privateFile).size;
                    if (privateFile === featuredImage) {
                        prvTorrent = pubTorrent;
                        makePost();
                    } else {
                        let destPrivatePath = Constants.TORRENT_FOLDER + publishAddress + '-p' + Constants.FILE_SEPARATOR;
                        torrentClient.createTorrent(privateFile, destPrivatePath, function (privateTorrent, file) {
                            console.log('Private Torrent created!', privateTorrent);
                            let tHash = Utils.makeHash(privateTorrent.magnetURI);
                            trantor.database.putTorrent(tHash, privateTorrent.magnetURI, privateTorrent.path, file);
                            prvTorrent = privateTorrent;
                            makePost()
                        })
                    }

                }
            }
        })
    });
}

function register() {
    modal.loading();
    let username = removeHtml($('#input-user-name').val());
    let description = removeHtml($('#input-user-description').val());
    let email = removeHtml($('#input-user-email').val());
    let web = removeHtml($('#input-user-web').val());

    getUserAddress(function (userAddress) {

        let onRegister = function (torrent) {
            trantor.register(userAddress, username, email, web, description, torrent, tags);
        };

        if (profileImage && profileImage.length > 0) {
            let destPath = Constants.TORRENT_FOLDER + userAddress + Constants.FILE_SEPARATOR;

            torrentClient.createTorrent(profileImage, destPath, function (torrent) {
                console.log('Register torrent', torrent);
                onRegister(torrent)
            })
        } else {
            onRegister(null);
        }


    });

}

function onTagsChange() {
    tags = $('#tags').tagsinput('items');
    publishTags = $('#publish-tags').tagsinput('items');
}

function showProfileImage(file) {
    $('#input-profile-image').attr('src', file);
}

function cropImage(file) {
    $('#input-profile-image').croppie({
        viewport: {
            width: 200,
            height: 200
        }
    });
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

        profileImage = fileNames[0];
        showProfileImage(profileImage);

        let cropperOptions = {
            uploadUrl: profileImage,
            modal: true
        };
    })
}

function clearArticleForm() {
    $('#publish-title').val('');
    $('#publish-description').val('');
    $('#publish-price').val(0);
    $('#publish-content-file').val('');
    privateFile = null;
    featuredImage = null;
}