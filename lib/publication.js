
let dragDrop = require('drag-drop');

let featuredImage, contentFile;

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

function getLicense() {
    let checked = $('input[name="publish-license[]"]:checked').attr('id');
    console.log(checked);
}

function publishContent() {
    let title = $('#publish-title').text();
    let description = $('#publish-description').text();
    let tags = $('#publish-tags').text();
    let price = $('#publish-price').text();
    //price = Coin.parseCash(price, 'CREA').amount;
    let license = getLicense();
    let contentType = '';
    //makePost(title, description, contentType, license, tags, featuredImage, contentFile, price);
}
