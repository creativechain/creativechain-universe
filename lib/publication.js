
let dragDrop = require('drag-drop');

let featuredImage, contentFile;

function prepareDragDrop() {
    dragDrop('#drag-drop', function (files) {
        console.log(files)
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
        $('#drag-drop').html('<img src="' + featuredImage + '" width="25%" height="25%"/>' +
            '<button onclick="loadFeaturedImages()" type="button" class="btn btn-primary" translate="yes" data-target=".modal-publish">' +
            '   ' + lang["Select file"] +
            '</button>' +
            '<p class="maxim-size" translate="yes">' + lang["MaximumFileSize"] + '</p>')
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

function publishContent() {

}
