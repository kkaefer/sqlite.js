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



function Cell(page) {
    nonEnumerable(this, 'page', page);
}
Cell.prototype.getRecord = function(callback) {
    if (this.overflowPage) return callback(new Error('TODO: implement reading from overflow pages'));

    var r, b;
    var c = this.page._bytes;
    var d = this.page._data;

    // Begin of header section.
    var p = this.payload;

    // Determine begin of data section.
    if ((r = c[p++]) >= 0x7f) {
        for (r = r & 0x7f, b = 1; c[p] > 0x7f && b < 8; b++) r = r * 0x7f + (c[p++] & 0x7f);
        r = r * 0xff + c[p++];
    }
    var header = this.payload + r;
    var q = header;

    var fields = [this.rowid];
    while (p < header) {
        // Read type.
        if ((r = c[p++]) >= 0x7f) {
            // console.warn(r & 0x7f, c[p]);
            for (r = r & 0x7f, b = 1; c[p] > 0x7f && b < 8; b++) {
                r = r * 0x80 + (c[p++] & 0x7f);
            }
            r = r * 0x80 + c[p++];
        }
        // console.warn(r);

        // Read data.
        if (r === 0) { // NULL
            fields.push(null);
        } else if (r === 1) {
            fields.push(d.getInt8(q++));
        } else if (r === 2) {
            fields.push(d.getInt16(q));
            q += 2;
        } else if (r >= 13 && r % 2 == 1) { // String
            var l = (r - 13) / 2;
            // console.warn(l);
            l += q;
            var str = '';
            // TODO: unicode handling
            while (q < l) str += String.fromCharCode(c[q++]);
            fields.push(str);
        } else {
            return callback(new Error('Type ' + r + ' not implemented'));
        }
    }

    callback(null, fields);
};



exports.BTree = BTreePage;

function BTreePage(buffer, no, reserved) {
    var data = new DataView(buffer);
    this.size = buffer.byteLength - reserved;

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
