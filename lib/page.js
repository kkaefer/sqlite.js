var async = require('async');

var Page = exports;

var INDEX = 2;
var TABLE = 5;
var INTERIOR = 0;
var LEAF = 8;

var INDEX_INTERIOR = INDEX | INTERIOR;
var INDEX_LEAF = INDEX | LEAF;
var TABLE_INTERIOR = TABLE | INTERIOR;
var TABLE_LEAF = TABLE | LEAF;


Page.LEAF = LEAF;
Page.INDEX = INDEX;
Page.BTREE = 0;
Page.OVERFLOW = 1;


function nonEnumerable(obj, prop, value) {
    Object.defineProperty(obj, prop, {
        enumerable: false,
        value: value
    });
}

var chr = String.fromCharCode;


function Cell(page) {
    nonEnumerable(this, 'page', page);
}
Cell.prototype._readPayload = function(bytes, data, position, callback) {
    var r, b;
    var c = bytes;
    var d = data;

    // Begin of header section.
    var p = position; // Header section pointer.

        // Determine begin of data section.
    if((r=c[p++])>0x7f){r=r&0x7f;for(b=1;c[p]>0x7f&&b<8;b++)r=r*0x80+(c[p++]&0x7f);r=r*(b==8?0x100:0x80)+c[p++];}
    var dataSection = position + r;
    var q = dataSection; // Data section pointer.

    var fields = [];
    if ('rowid' in this) fields.push(this.rowid);

    while (p < dataSection) {
        // Read type.
        if((r=c[p++])>0x7f){r=r&0x7f;for(b=1;c[p]>0x7f&&b<8;b++)r=r*0x80+(c[p++]&0x7f);r=r*(b==8?0x100:0x80)+c[p++];}

        // Read data.
        if (r === 0) { // NULL
            fields.push(null);
        } else if (r === 1) {
            fields.push(d.getInt8(q++));
        } else if (r === 2) {
            fields.push(d.getInt16(q));
            q += 2;
        } else if (r === 3) {
            fields.push(d.getInt32(q - 1) << 8 >> 8);
            q += 3;
        } else if (r >= 13 && r % 2 === 1) { // String
            var len = (r - 13) / 2;
            var end = q + len;

            var str = '';
            if (this.page.db.textEncoding === 1) { // UTF-8
                while (q < end) {
                    if (c[q] <= 0x7F) str += chr(c[q++]);
                    else if (c[q] <= 0xBF) return callback(new Error('Invalid UTF-8 codepoint: ' + c[q]));
                    else if (c[q] <= 0xDF) str += chr((c[q++] & 0x1F) << 6 | (c[q++] & 0x3F));
                    else if (c[q] <= 0xEF) str += chr((c[q++] & 0x1F) << 12 | (c[q++] & 0x3F) << 6 | (c[q++] & 0x3F));
                    else if (c[q] <= 0xF7) q += 4; // We can't handle these codepoints in JS, so skip.
                    else if (c[q] <= 0xFB) q += 5;
                    else if (c[q] <= 0xFD) q += 6;
                    else return callback(new Error('Invalid UTF-8 codepoint: ' + c[q]));
                }
            } else {
                return callback(new Error('UTF-16 is not supported'));
            }

            fields.push(str);
        } else if (r >= 12 && r % 2 === 0) {
            var len = (r - 12) / 2;
            fields.push(c.subarray(q, q + len));
            q += len;
        } else {
            return callback(new Error('Type ' + r + ' not implemented'));
        }
    }

    callback(null, fields, this);
};

Cell.prototype.getRecord = function(callback) {
    if (this.overflowPage) {
        var cell = this;
        var buffer = new ArrayBuffer(this.length);
        var assembled = new Uint8Array(buffer);

        // Write internal payload
        var offset = this.localLength;
        assembled.set(this.page._bytes.subarray(this.payload, this.payload + offset), 0);
        appendOverflowPage(this.overflowPage);

        function appendOverflowPage(no) {
            cell.page.db._retrievePage(no, Page.OVERFLOW, function(err, page) {
                if (err) return callback(err);
                if (!page.right) {
                    // This is the last overflow page in the chain.
                    assembled.set(page._bytes.subarray(0, cell.length - offset), offset);
                    cell._readPayload(assembled, new DataView(buffer), 0, callback);
                } else {
                    assembled.set(page._bytes, offset);
                    offset += page.size;
                    appendOverflowPage(page.right);
                }
            });
        }
    } else {
        this._readPayload(this.page._bytes, this.page._data, this.payload, callback);
    }
};


Page.Overflow = OverflowPage;
function OverflowPage(buffer, no, db) {
    var data = new DataView(buffer, 0, 4);
    this.size = buffer.byteLength - db.reservedSpace - 4;
    this.right = data.getUint32(0);
    nonEnumerable(this, '_bytes', new Uint8Array(buffer, 4, this.size));
}



Page.BTree = BTreePage;
function BTreePage(buffer, no, db) {
    var data = new DataView(buffer);
    this.size = buffer.byteLength - db.reservedSpace;
    this.no = no;

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

    if (this.type === TABLE_LEAF) {
        this.minLocal = db.minLeaf;
        this.maxLocal = db.maxLeaf;
    } else if (this.type !== TABLE_INTERIOR) {
        this.minLocal = db.minLocal;
        this.maxLocal = db.maxLocal;
    }

    nonEnumerable(this, 'db', db);
    nonEnumerable(this, '_data', data);
    nonEnumerable(this, '_bytes', new Uint8Array(buffer));
}

// Reading varint:
// if((r=c[p++])>0x7f){r=r&0x7f;for(b=1;c[p]>0x7f&&b<8;b++)r=r*0x80+(c[p++]&0x7f);r=r*(b==8?0x100:0x80)+c[p++];}
//
// expands to
//
// var result = content[position++];
// if (result > 0x7f) {
//     result = result & 0x7f;
//     for (var bytes = 1; content[position] > 0x7f && bytes < 8; bytes++) {
//         result = result * 0x80 + (content[position++] & 0x7f);
//     }
//     result = result * (bytes == 8 ? 0x100 : 0x80) + content[position++];
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
        if((r=c[p++])>0x7f){r=r&0x7f;for(b=1;c[p]>0x7f&&b<8;b++)r=r*0x80+(c[p++]&0x7f);r=r*(b==8?0x100:0x80)+c[p++];}
        cell.key = r;
    } else {
        if((r=c[p++])>0x7f){r=r&0x7f;for(b=1;c[p]>0x7f&&b<8;b++)r=r*0x80+(c[p++]&0x7f);r=r*(b==8?0x100:0x80)+c[p++];}
        cell.length = r;

        if (this.type === TABLE_LEAF) {
            if((r=c[p++])>0x7f){r=r&0x7f;for(b=1;c[p]>0x7f&&b<8;b++)r=r*0x80+(c[p++]&0x7f);r=r*(b==8?0x100:0x80)+c[p++];}
            cell.rowid = r;
        }

        cell.payload = p;

        if (cell.length > this.maxLocal) {
            // Payload spills into overflow pages.
            var surplus = this.minLocal + (cell.length - this.minLocal) % (this.size - 4);
            cell.localLength = surplus <= this.maxLocal ? surplus : this.minLocal;
            cell.overflowPage = d.getUint32(cell.payload + cell.localLength);
        } else {
            // Payload is all-local.
            cell.localLength = cell.length;
        }
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
