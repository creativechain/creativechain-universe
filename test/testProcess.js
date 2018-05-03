
process.on('message', (data) => {
    console.log('From main thread', data);
    process.send('Response from child thread: ' + data);
});