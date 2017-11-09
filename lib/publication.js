
let dragDrop = require('drag-drop');
const {dialog} = require('electron').remote;

let featuredImage, contentFile, privateFile, profileImage;
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
            Notifications.notify(lang.ContentPublished, lang.ContentPublishedSuccessfully, './assets/img/publications1.png', 5);
            let tx = DecodedTransaction.fromHex(txBuffer.toString('hex'));
            trantor.events.notify('onAfterPublish', 10, tx, mediaPost);
        }
    })
});

function setUserData() {
    let userAddress = localStorage.getItem('userAddress');
    trantor.getUserData(userAddress, function (err, results) {
        if (err) {
            console.error(err);
        } else if (results && results.length > 0) {
            let user = results[0];
            //console.log(user);
            let avatar = resolveAvatar(user.avatarFile, user.address);
            let buzz = BUZZ.getBuzz(user.likes, user.comments, user.publications, 0);

            $('#user-publish-name').html(user.name);
            $('#user-publish-web').html(user.web || user.description);
            $('#user-publish-avatar').attr('src', avatar);
            $('#user-publish-level-icon').attr('src', buzz.icon);
            $('#user-publish-level').html(buzz.levelText);
            $('#user-publish-buzz').html(buzz.rate + ' Buzz');
        }
    })
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
        showPreviewImage(featuredImage)
    })
}

function loadContentFile() {
    dialog.showOpenDialog((fileNames) => {
        if(fileNames === undefined){
            console.log("No file selected");
            return;
        }

        contentFile = fileNames[0];

    })
}

function showPreviewImage(featuredImage) {
    $('#drag-drop').html('<img src="' + featuredImage + '" width="25%" height="25%"/>' +
        '<br><br><button onclick="loadFeaturedImages()" type="button" class="btn btn-primary" translate="yes" data-target=".modal-publish">' +
        '   ' + lang["LoadOtherImage"] +
        '</button>' +
        '<p class="maxim-size" translate="yes">' + lang["MaximumFileSize"] + '</p>')
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
    let title = $('#publish-title').val();
    let description = $('#publish-description').val();
    let price = $('#publish-price').val();
    price = price || 0;
    price = Coin.parseCash(price, 'CREA').amount;
    let license = getLicense();
    let contentType = mimeType(privateFile || featuredImage);
    let userAddress = localStorage.getItem('userAddress');

    trantor.client.getNewAddress(function (err, result) {
        let publishAddress = result.result;
        let pubTorrent, prvTorrent;
        let tasks = 0;
        let makePost = function () {
            tasks--;
            if (tasks === 0) {
                trantor.publish(userAddress, publishAddress, title, description, contentType, license, publishTags, pubTorrent, prvTorrent, price);
            }
        };

        if (featuredImage) {
            tasks++;
            let destPublicPath = Constants.TORRENT_FOLDER + publishAddress + Constants.FILE_SEPARATOR;
            torrentClient.createTorrent(featuredImage, destPublicPath, function (publicTorrent) {
                console.log('Public Torrent created!', publicTorrent);
                pubTorrent = publicTorrent;
                makePost();
            })
        }

        if (privateFile) {
            tasks++;
            let destPrivatePath = Constants.TORRENT_FOLDER + publishAddress + '-p' + Constants.FILE_SEPARATOR;
            torrentClient.createTorrent(privateFile, destPrivatePath, function (privateTorrent) {
                console.log('Private Torrent created!', privateTorrent);
                prvTorrent = privateTorrent;
                makePost()
            })
        }
    })

}

function register() {
    let username = $('#input-user-name').val();
    let description = $('#input-user-description').val();
    let email = $('#input-user-email').val();
    let web = $('#input-user-web').val();
    let userAddress = localStorage.getItem('userAddress');
    let destPath = Constants.TORRENT_FOLDER + userAddress + Constants.FILE_SEPARATOR;
    torrentClient.createTorrent(profileImage, destPath, function (torrent) {
        trantor.register(userAddress, username, email, web, description, torrent, tags);
    })

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