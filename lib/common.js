
trantor.start(function () {
    console.log('Trantor started!');

    trantor.explore();
    setInterval(function () {
        trantor.explore();
    }, 10 * 1000);
});