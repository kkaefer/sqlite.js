var SQLite = exports;

if (typeof process !== 'undefined' && typeof process.title !== 'undefined') {
    // node.js
    var IO = require('./io');
    var Page = require('./page');
    var nextTick = process.nextTick;
} else {
    var nextTick = window.setTimeout;
}

function makeEventEmitter(child) {
    var EE = typeof EventEmitter !== 'undefined' ? EventEmitter : process.EventEmitter;
    child.prototype = Object.create(EE.prototype, {
        constructor: { value: child, enumerable: false, writable: true, configurable: true }
    });
}

makeEventEmitter(Database);
SQLite.Database = Database;
function Database(file) {
    this.opened = false;
    this.tables = {};
    this.views = {};
    this.indexes = {};
    this.triggers = {};

    this._pageCache = {};
    var db = this;

    function stattedFile(err, stat) {
        if (err) return db.emit('error', err);
        db.stat = stat;
        IO.open(file, openedFile);
    }

    function openedFile(err, fd) {
        if (err) return db.emit('error', err);
        db.fd = fd;
        db._open();
    }

    // Call in nextTick to allow attaching event handlers in the current tick.
    nextTick(function() {
        IO.stat(file, stattedFile);
    });
}

Database.HEADER = [0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66, 0x6f, 0x72, 0x6d, 0x61, 0x74, 0x20, 0x33, 0x00];

Database.prototype._open = function() {
    var db = this;
    IO.read(db.fd, 0, 100, function(err, buffer) {
        if (err) return db.emit('error', err);

        var header = new Uint8Array(buffer, 0, Database.HEADER.length)
        for (var i = 0; i < Database.HEADER.length; i++) {
            if (header[i] !== Database.HEADER[i]) {
                return db.emit('error', new Error('Header check failed'));
            }
        }

        var view = new DataView(buffer);
        db.pageSize = view.getUint16(16);
        if (db.pageSize === 1) db.pageSize = 65536;
        db.writeVersion = view.getUint8(18);
        db.readVersion = view.getUint8(19);
        db.reservedSpace = view.getUint8(20);
        db.maxEmbeddedPayloadFraction = view.getUint8(21);
        db.minEmbeddedPayloadFraction = view.getUint8(22);
        db.leafPayloadFraction = view.getUint8(23);
        db.fileChangeCounter = view.getUint32(24);
        db.pages = view.getUint32(28);
        db.firstFreelistTrunk = view.getUint32(32);
        db.freelistPages = view.getUint32(36);
        db.schemaCookie = view.getUint32(40);
        db.schemaFormat = view.getUint32(44);
        db.defaultPageCacheSize = view.getUint32(48);
        db.largestBTreePage = view.getUint32(52);
        db.textEncoding = view.getUint32(56);
        db.userVersion = view.getUint32(60);
        db.incrementalVacuum = view.getUint32(64);
        db.versionValidFor = view.getUint32(92);
        db.sqliteVersion = view.getUint32(96);

        // Calculated values.
        db.usablePageSize = db.pageSize - db.reservedSpace;
        db.minLocal = ((db.usablePageSize - 12) * 32 / 255 | 0) - 23;
        db.maxLocal = ((db.usablePageSize - 12) * 64 / 255 | 0) - 23;
        db.minLeaf = db.minLocal;
        db.maxLeaf = db.usablePageSize - 35;

        db._loadSchema(function(err) {
            if (err) db.emit('error', err);
            else {
                db.opened = true;
                db.emit('open');
            }
        });
    });
};

Database.prototype._retrievePage = function(no, type, callback) {
    if (this._pageCache[no] && this._pageCache[no].loaded) {
        var page = this._pageCache[no];
        if (page.error) {
            return callback(page.error);
        } else {
            return callback(null, page);
        }
    }

    // Start loading the page
    if (!this.pages[no]) {
        if (type === Page.BTREE) {
            var page = new Page.BTree(no, this);
        } else if (type === Page.OVERFLOW) {
            var page = new Page.Overflow(no, this);
        } else {
            return callback(new Error('Page type not yet implemented'));
        }

        IO.read(this.fd, (no - 1) * this.pageSize, this.pageSize, function(err, buffer) {
            if (err) {
                page.error = err;
                page.emit('error', err);
            } else {
                page.setBuffer(buffer);
                page.loaded = true;
                page.emit('load');
            }
        });

        this._pageCache[no] = page;
    }

    this._pageCache[no].on('load', function() { callback(null, this); });
    this._pageCache[no].on('error', function(err) { callback(err); });
};

// This function loads an *entire* table. Use with caution.
Database.prototype._loadPageData = function(no, callback) {
    var db = this;
    this._retrievePage(no, Page.BTREE, function(err, page) {
        if (err) return callback.call(db, err);

        if (page.leaf) {
            page.loadRecords(callback.bind(db));
        } else {
            // This is an interior page.
            var pages = page.loadCells().map(function(cell) { return cell.left; });
            pages.push(page.right);

            var remaining = pages.length, result = [];
            pages.map(function(no, i) {
                db._loadPageData(no, function(err, value) {
                    if (err) { remaining = -1; return callback(err); }
                    result[i] = value; remaining--;
                    if (remaining === 0) callback(null, result.reduce(function(a, b) { return a.concat(b); }));
                });
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

Database.prototype._scanIndexPage = function(page, args, callback) {
    if (!page.cells) return callback(new Error('Page is empty'));

    var db = this;
    function scan(no) {
        page.getCell(no).getRecord(function gotCellRecord(err, fields, cell) {
            if (err) return callback(err);

            for (var i = 0; i < args.length; i++) {
                if (fields[i] > args[i]) {
                    if (cell.left) {
                        // Continue with left page.
                        return db._btreeSearch(cell.left, args, callback);
                    } else {
                        // We've reached the end of our search.
                        return callback(null);
                    }
                } else if (fields[i] < args[i]) {
                    if (no + 1 >= page.cells) {
                        if (page.right) {
                            // Continue with right page.
                            return db._btreeSearch(page.right, args, callback);
                        } else {
                            // We've reached the end of our search.
                            return callback(null);
                        }
                    } else {
                        // Continue with next cell.
                        return scan(no + 1);
                    }
                }
            }

            // All fields match.
            return callback(null, fields);
        });
    }

    scan(0);
};

Database.prototype._scanTablePage = function(page, rowid, callback) {
    if (page.leaf) {
        // This is a leaf page.
        for (var i = 0; i < page.cells; i++) {
            var cell = page.getCell(i);
            if (cell.rowid === rowid) {
                return cell.getRecord(function(err, fields) {
                    if (err) return callback(err);
                    callback(null, fields);
                });
            }
        }

        // Didn't find cell on this page.
        return callback(null);
    } else {
        // This is an interior page.
        for (var i = 0; i < page.cells; i++) {
            var cell = page.getCell(i);
            // Continue with left page.
            if (cell.key >= rowid) {
                if (cell.left) {
                    // Continue with left page.
                    return this._btreeSearch(cell.left, rowid, callback);
                } else {
                    // We've reached the end of our search.
                    return callback(null);
                }
            }
        }

        if (page.right) {
            // No left cell matched; continue with right page.
            return this._btreeSearch(page.right, rowid, callback);
        } else {
            // We've reached the end of our search.
            return callback(null);
        }
    }
};

Database.prototype._btreeSearch = function(no, args, callback) {
    var db = this;
    this._retrievePage(no, Page.BTREE, function(err, page) {
        if (err) return callback(err);

        if (page.type & Page.INDEX) {
            db._scanIndexPage(page, args, callback);
        } else {
            db._scanTablePage(page, args, callback);
        }
    });
};

Database.prototype._indexSearch = function(options, args, callback) {
    if (!this.indexes[options.name]) return callback(new Error('Index ' + options.name + ' does not exist'));
    this._btreeSearch(this.indexes[options.name].rootpage, args[0], function(err, result) {
        if (err) return callback(err);
        if (result) return callback(null, result[result.length - 1]);
        callback(null);
    });
};

Database.prototype._tableSearch = function(options, args, callback) {
    if (!this.tables[options.name]) return callback(new Error('Table ' + options.name + ' does not exist'));
    this._btreeSearch(this.tables[options.name].rootpage, args[0], function(err, result) {
        if (err) return callback(err);
        if (result) {
            if (options.select) {
                return callback(null, options.select.map(function(index) {
                    return result[index];
                }));
            } else {
                return callback(null, result);
            }
        } else {
            callback(null);
        }
    });
};

// Executes a query plan.
Database.prototype.execute = function(plan, input, callback) {
    var db = this;
    var i = 0;
    nextTick(function() { run(plan[i], input); });

    function next(err, result) {
        if (err) return callback(err);
        if (typeof result === 'undefined') return callback(null, []);
        if (!plan[i + 1]) return callback(null, result);

        // Cut the stack.
        nextTick(function() { run(plan[++i], result); });
    }

    function run(step, input) {
        if (step.type == 'index') {
            db._indexSearch(step, [input], next);
        } else if (step.type === 'table') {
            db._tableSearch(step, [input], next);
        } else {
            callback(new Error('Unknown step ' + step.type));
        }
    }
};
