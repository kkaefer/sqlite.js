var async = require('async');

var INDEX = 2;
var TABLE = 5;
var INTERIOR = 0;
var LEAF = 8;

var INDEX_INTERIOR = INDEX | INTERIOR;
var INDEX_LEAF = INDEX | LEAF;
var TABLE_INTERIOR = TABLE | INTERIOR;
var TABLE_LEAF = TABLE | LEAF;


exports.LEAF = LEAF;


function nonEnumerable(obj, prop, value) {
    Object.defineProperty(obj, prop, {
        enumerable: false,
        value: value
    });
}

var chr = String.fromCharCode;


function Cell(page, db) {
    nonEnumerable(this, 'page', page);
}
Cell.prototype.getRecord = function(callback) {
    if (this.overflowPage) return callback(new Error('TODO: implement reading from overflow pages'));

    var r, b;
    var c = this.page._bytes;
    var d = this.page._data;

    // Begin of header section.
    var p = this.payload; // Header section pointer.

    // Determine begin of data section.
    if ((r = c[p++]) >= 0x7f) {
        for (r = r & 0x7f, b = 1; c[p] > 0x7f && b < 8; b++) r = r * 0x7f + (c[p++] & 0x7f);
        r = r * 0xff + c[p++];
    }
    var data = this.payload + r;
    var q = data; // Data section pointer.

    var fields = [this.rowid];
    while (p < data) {
        // Read type.
        if ((r = c[p++]) >= 0x7f) {
            for (r = r & 0x7f, b = 1; c[p] > 0x7f && b < 8; b++) {
                r = r * 0x80 + (c[p++] & 0x7f);
            }
            r = r * 0x80 + c[p++];
        }

        // Read data.
        if (r === 0) { // NULL
            fields.push(null);
        } else if (r === 1) {
            fields.push(d.getInt8(q++));
        } else if (r === 2) {
            fields.push(d.getInt16(q));
            q += 2;
        } else if (r >= 13 && r % 2 == 1) { // String
            var len = q + (r - 13) / 2;

            var str = '';
            if (this.page.db.textEncoding === 1) { // UTF-8
                while (q < len) {
                    if (c[q] <= 0x7F) str += chr(c[q++]);
                    else if (c[q] <= 0xBF) return callback(new Error('Invalid UTF-8 codepoint'));
                    else if (c[q] <= 0xDF) str += chr((c[q++] & 0x1F) << 6 | (c[q++] & 0x3F));
                    else if (c[q] <= 0xEF) str += chr((c[q++] & 0x1F) << 12 | (c[q++] & 0x3F) << 6 | (c[q++] & 0x3F));
                    else if (c[q] <= 0xF7) i += 4; // We can't handle these codepoints in JS, so skip.
                    else if (c[q] <= 0xFB) i += 5;
                    else if (c[q] <= 0xFD) i += 6;
                    else return callback(new Error('Invalid UTF-8 codepoint'));
                }
            } else {
                return callback(new Error('UTF-16 is not supported'));
            }

            fields.push(str);
        } else {
            return callback(new Error('Type ' + r + ' not implemented'));
        }
    }

    callback(null, fields);
};



exports.BTree = BTreePage;

function BTreePage(buffer, no, db) {
    var data = new DataView(buffer);
    this.size = buffer.byteLength - db.reservedSpace;

    // Skip the database header on the first page.
    var offset = no == 1 ? 100 : 0;
    this.type = data.getUint8(offset);
    this.leaf = (this.type & LEAF) > 0;

    if (!this.leaf) {
        this.right = data.getUint32(offset + 8);
    }

    this.cells = data.getUint16(offset + 3);
    var pointerOffset = offset + (this.leaf ? 8 : 12);
    this.pointers = [];
    for (var i = 0; i < this.cells; i++) {
        this.pointers[i] = data.getUint16(pointerOffset + i * 2);
    }

    nonEnumerable(this, 'db', db);
    nonEnumerable(this, '_data', data);
    nonEnumerable(this, '_bytes', new Uint8Array(buffer));
}

// Reading varint:
// if((r=c[p++])>=0x7f){for(r=r&0x7f,b=1;c[p]>0x7f&&b<8;b++)r=r*0x7f+(c[p++]&0x7f);r=r*0xff+c[p++];}
//
// expands to
//
// var result = content[position++];
// if (result >= 0x7f) {
//     result = result & 0x7f;
//     for (var bytes = 1; content[position] > 0x7f && bytes < 8; bytes++) {
//         result = result * 0x7f + (content[position++] & 0x7f);
//     }
//     result = result * 0xff + content[position++];
// }


BTreePage.prototype.getCell = function(no) {
    if (no >= this.cells) return;
    return this.getCellAt(this.pointers[no]);
}

BTreePage.prototype.getCellAt = function(p) {
    var c = this._bytes;
    var d = this._data;
    var cell = new Cell(this);

    if (this.type === TABLE_INTERIOR || this.type === INDEX_INTERIOR) {
        cell.left = d.getUint32(p);
        p += 4;
    }

    var r, b;
    if (this.type === TABLE_INTERIOR) {
        if ((r = c[p++]) >= 0x7f) {
            for (r = r & 0x7f, b = 1; c[p] > 0x7f && b < 8; b++) r = r * 0x7f + (c[p++] & 0x7f);
            r = r * 0xff + c[p++];
        }
        cell.key = r;
    } else {
        if ((r = c[p++]) >= 0x7f) {
            for (r = r & 0x7f, b = 1; c[p] > 0x7f && b < 8; b++) r = r * 0x7f + (c[p++] & 0x7f);
            r = r * 0xff + c[p++];
        }
        cell.length = r;
        cell.internalLength = r;

        var U = this.size,
            P = cell.length,
            X;
        if (this.type === TABLE_LEAF) {
            if ((r = c[p++]) >= 0x7f) {
                for (r = r & 0x7f, b = 1; c[p] > 0x7f && b < 8; b++) r = r * 0x7f + (c[p++] & 0x7f);
                r = r * 0xff + c[p++];
            }
            cell.rowid = r;
            X = U - 35;
        } else {
            X = ((U - 12) * 64 / 255) - 23;
        }

        if (P > X) {
            var M = ((U - 12) * 32 / 255) - 23;
            cell.internalLength = Math.min(M + ((P - M) % (U - 4)), X);
            cell.overflowPage = d.getUint32(p + cell.internalLength);
        }

        cell.payload = p;
    }

    return cell;
};

BTreePage.prototype.loadCells = function() {
    return this.pointers.map(this.getCellAt, this);
};

BTreePage.prototype.loadRecords = function(callback) {
    var page = this;
    async.map(this.pointers, function(pointer, callback) {
        page.getCellAt(pointer).getRecord(callback);
    }, function(err, result) {
        if (err) return callback(err);
        callback(null, result);
    });
};
