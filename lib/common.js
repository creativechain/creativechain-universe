
trantor.start(function () {
    console.log('Trantor started!');

    let lastExploredBlock = localStorage.getItem('lastExploredBlock');
    if (!lastExploredBlock) {
        lastExploredBlock = 1;
    }

    trantor.explore(lastExploredBlock);
});