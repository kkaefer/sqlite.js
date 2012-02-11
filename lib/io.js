var io = exports;
var fs = require('fs');

// node.js
io.open = function(file, callback) {
    fs.open(file, 'r', callback);
};

io.read = function(fd, offset, length, callback) {
    var buffer = new Buffer(length);
    fs.read(fd, buffer, 0, length, offset, function(err) {
        if (err) callback(err);
        else callback(null, new Uint8Array(buffer).buffer);
    });
};

io.close = function(fd, callback) {
    fs.close(fd, callback);
};
