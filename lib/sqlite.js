var util = require('util');
var EventEmitter =  require('events').EventEmitter;
var async = require('async');
var IO = require('./io');
var Page = require('./page');

var HEADER = [0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66, 0x6f, 0x72, 0x6d, 0x61, 0x74, 0x20, 0x33, 0x00];
var BTREE = 0;

function equals(actual, reference) {
    if (actual.length < reference.length) return false;
    for (var i = 0; i < reference.length; i++) {
        if (reference[i] != actual[i]) return false;
    }
    return true;
}

exports.Database = Database;
util.inherits(Database, EventEmitter);

function Database(file) {
    this.tables = {};
    this.views = {};
    this.indexes = {};
    this.triggers = {};

    // Call in nextTick to allow attaching event handlers in the current tick.
    var open = this._open.bind(this);
    process.nextTick(function() {
        IO.open(file, open);
    });
}

Database.prototype._open = function(err, fd) {
    if (err) return this.emit('error', err);

    var db = this;
    db.fd = fd;
    IO.read(db.fd, 0, 100, function(err, buffer) {
        if (err) return db.emit('error', err);

        if (!equals(new Uint8Array(buffer, 0, HEADER.length), HEADER)) {
            return db.emit('error', new Error('Header check failed'));
        }

        var view = new DataView(buffer);
        db.pageSize = view.getUint16(16);
        // db.writeVersion = view.getUint8(18);
        // db.readVersion = view.getUint8(19);
        db.reservedSpace = view.getUint8(20);
        // db.maxEmbeddedPayloadFraction = view.getUint8(21);
        // db.minEmbeddedPayloadFraction = view.getUint8(22);
        // db.leafPayloadFraction = view.getUint8(23);
        // db.fileChangeCounter = view.getUint32(24);
        db.pages = view.getUint32(28);
        // db.firstFreelistTrunk = view.getUint32(32);
        // db.freelistPages = view.getUint32(36);
        // db.schemaCookie = view.getUint32(40);
        // db.schemaFormat = view.getUint32(44);
        // db.defaultPageCacheSize = view.getUint32(48);
        // db.largestBTreePage = view.getUint32(52);
        // db.textEncoding = view.getUint32(56);
        // db.userVersion = view.getUint32(60);
        // db.incrementalVacuum = view.getUint32(64);
        // db.versionValidFor = view.getUint32(92);
        // db.sqliteVersion = view.getUint32(96);

        if (db.pageSize === 1) db.pageSize = 65536;

        db._loadSchema(function(err) {
            if (err) db.emit('error', err);
            else db.emit('open');
        });
    });
};

Database.prototype._retrievePage = function(no, type, callback) {
    var db = this;
    IO.read(db.fd, (no - 1) * db.pageSize, db.pageSize, function(err, buffer) {
        if (err) return callback(err);

        if (type === BTREE) {
            var page = new Page.BTree(buffer, no, db.reservedSpace);
        } else {
            return db.emit('error', new Error('Page type not yet implemented'));
        }

        callback(null, page);
    });
};

function toBuffer(b) {
    b.length = b.byteLength;
    var r = new Buffer(b);
    delete b.length;
    return r;
}

Database.prototype._loadPageData = function(no, callback) {
    var db = this;
    this._retrievePage(no, BTREE, function(err, page) {
        if (err) return callback(err);

        if (page.type & Page.LEAF) {
            page.loadRecords(callback);
        } else {
            // This is an interior page. We have to
            var pages = page.loadCells().map(function(cell) { return cell.left; });
            pages.push(page.right);
            async.map(pages, db._loadPageData.bind(db), function(err, data) {
                if (err) return callback(err);
                callback(null, data.reduce(function(a, b) { return a.concat(b); }))
            });
        }
    });
}

Database.prototype._loadSchema = function(callback) {
    var db = this;
    this._loadPageData(1, function(err, result) {
        if (err) return callback(err);

        for (var i = 0; i < result.length; i++) {
            var row = result[i];
            switch (row[1]) {
                case 'table': db.tables[row[2]] = { rootpage: row[4], sql: row[5] }; break;
                case 'index': db.indexes[row[2]] = { table: row[3], rootpage: row[4], sql: row[5] }; break;
                case 'view': db.views[row[2]] = { sql: row[5] }; break;
                case 'trigger': db.triggers[row[2]] = { table: row[3], sql: row[5] }; break;
            }
        }

        callback(null);
    });
};

Database.prototype.readTable = function(name, callback) {
    var table = this.tables[name];
    if (!table) return callback(new Error('Table ' + name + ' does not exist.'));
    this._loadPageData(table.rootpage, callback);
};
