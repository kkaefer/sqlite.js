var IO = exports;

if (typeof process !== 'undefined' && typeof process.title !== 'undefined') {
    // node.js
    var fs = require('fs');
    var path = require('path');

    IO.open = function(file, callback) {
        fs.open(file, 'r', callback);
    };

    IO.stat = function(file, callback) {
        fs.stat(file, function(err, stat) {
            if (err) return callback(err);
            callback(null, {
                name: path.basename(file),
                size: stat.size,
                modified: stat.mtime
            });
        });
    };

    IO.read = function(fd, offset, length, callback) {
        var buffer = new Buffer(length);
        fs.read(fd, buffer, 0, length, offset, function(err) {
            if (err) callback(err);
            else callback(null, new Uint8Array(buffer).buffer);
        });
    };

    IO.close = function(fd, callback) {
        fs.close(fd, callback);
    };
} else {
    // Browser
    IO.open = function(file, callback) {
        callback(null, file);
    };

    IO.stat = function(file, callback) {
        callback(null, {
            name: file.fileName,
            size: file.fileSize,
            modified: file.lastModifiedDate
        });
    };

    var slice = File.prototype.slice || File.prototype.webkitSlice || File.prototype.mozSlice;
    IO.read = function(file, offset, length, callback) {
        var reader = new FileReader();
        reader.readAsArrayBuffer(slice.call(file, offset, offset + length));
        reader.onerror = function(e) {
            callback(e);
        };
        reader.onload = function(e) {
            callback(null, reader.result);
        };
    };

    IO.close = function(file, callback) {
        // noop
    };
}
