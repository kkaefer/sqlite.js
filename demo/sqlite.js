(function(exports) {
  var process = { EventEmitter: function() {} };
  
  if (typeof Array.isArray !== "function"){
    Array.isArray = function(obj){ return Object.prototype.toString.call(obj) === "[object Array]" };
  }
  
  if (!Array.prototype.indexOf){
    Array.prototype.indexOf = function(item){
        for ( var i = 0, length = this.length; i < length; i++ ) {
            if ( this[ i ] === item ) {
                return i;
            }
        }

        return -1;
    };
  }
  
  // Begin wrap of nodejs implementation of EventEmitter

  var EventEmitter = exports.EventEmitter = process.EventEmitter;

  var isArray = Array.isArray;

  EventEmitter.prototype.emit = function(type) {
    // If there is no 'error' event listener then throw.
    if (type === 'error') {
      if (!this._events || !this._events.error ||
          (isArray(this._events.error) && !this._events.error.length))
      {
        if (arguments[1] instanceof Error) {
          throw arguments[1]; // Unhandled 'error' event
        } else {
          throw new Error("Uncaught, unspecified 'error' event.");
        }
        return false;
      }
    }

    if (!this._events) return false;
    var handler = this._events[type];
    if (!handler) return false;

    if (typeof handler == 'function') {
      switch (arguments.length) {
        // fast cases
        case 1:
          handler.call(this);
          break;
        case 2:
          handler.call(this, arguments[1]);
          break;
        case 3:
          handler.call(this, arguments[1], arguments[2]);
          break;
        // slower
        default:
          var args = Array.prototype.slice.call(arguments, 1);
          handler.apply(this, args);
      }
      return true;

    } else if (isArray(handler)) {
      var args = Array.prototype.slice.call(arguments, 1);

      var listeners = handler.slice();
      for (var i = 0, l = listeners.length; i < l; i++) {
        listeners[i].apply(this, args);
      }
      return true;

    } else {
      return false;
    }
  };

  // EventEmitter is defined in src/node_events.cc
  // EventEmitter.prototype.emit() is also defined there.
  EventEmitter.prototype.addListener = function(type, listener) {
    if ('function' !== typeof listener) {
      throw new Error('addListener only takes instances of Function');
    }

    if (!this._events) this._events = {};

    // To avoid recursion in the case that type == "newListeners"! Before
    // adding it to the listeners, first emit "newListeners".
    this.emit('newListener', type, listener);

    if (!this._events[type]) {
      // Optimize the case of one listener. Don't need the extra array object.
      this._events[type] = listener;
    } else if (isArray(this._events[type])) {
      // If we've already got an array, just append.
      this._events[type].push(listener);
    } else {
      // Adding the second element, need to change to array.
      this._events[type] = [this._events[type], listener];
    }

    return this;
  };

  EventEmitter.prototype.on = EventEmitter.prototype.addListener;

  EventEmitter.prototype.once = function(type, listener) {
    var self = this;
    self.on(type, function g() {
      self.removeListener(type, g);
      listener.apply(this, arguments);
    });
  };

  EventEmitter.prototype.removeListener = function(type, listener) {
    if ('function' !== typeof listener) {
      throw new Error('removeListener only takes instances of Function');
    }

    // does not use listeners(), so no side effect of creating _events[type]
    if (!this._events || !this._events[type]) return this;

    var list = this._events[type];

    if (isArray(list)) {
      var i = list.indexOf(listener);
      if (i < 0) return this;
      list.splice(i, 1);
      if (list.length == 0)
        delete this._events[type];
    } else if (this._events[type] === listener) {
      delete this._events[type];
    }

    return this;
  };

  EventEmitter.prototype.removeAllListeners = function(type) {
    // does not use listeners(), so no side effect of creating _events[type]
    if (type && this._events && this._events[type]) this._events[type] = null;
    return this;
  };

  EventEmitter.prototype.listeners = function(type) {
    if (!this._events) this._events = {};
    if (!this._events[type]) this._events[type] = [];
    if (!isArray(this._events[type])) {
      this._events[type] = [this._events[type]];
    }
    return this._events[type];
  };

  // End nodejs implementation
}((typeof exports === 'undefined') ? window : exports));var SphericalMercator = (function(){

// Closures including constants and other precalculated values.
var cache = {},
    EPSLN = 1.0e-10,
    D2R = Math.PI / 180,
    R2D = 180 / Math.PI,
    // 900913 properties.
    A = 6378137,
    MAXEXTENT = 20037508.34;


// SphericalMercator constructor: precaches calculations
// for fast tile lookups.
function SphericalMercator(options) {
    options = options || {};
    this.size = options.size || 256;
    if (!cache[this.size]) {
        var size = this.size;
        var c = cache[this.size] = {};
        c.Bc = [];
        c.Cc = [];
        c.zc = [];
        c.Ac = [];
        for (var d = 0; d < 30; d++) {
            c.Bc.push(size / 360);
            c.Cc.push(size / (2 * Math.PI));
            c.zc.push(size / 2);
            c.Ac.push(size);
            size *= 2;
        }
    }
    this.Bc = cache[this.size].Bc;
    this.Cc = cache[this.size].Cc;
    this.zc = cache[this.size].zc;
    this.Ac = cache[this.size].Ac;
};

// Convert lon lat to screen pixel value
//
// - `ll` {Array} `[lon, lat]` array of geographic coordinates.
// - `zoom` {Number} zoom level.
SphericalMercator.prototype.px = function(ll, zoom) {
    var d = this.zc[zoom];
    var f = Math.min(Math.max(Math.sin(D2R * ll[1]), -0.9999), 0.9999);
    var x = Math.round(d + ll[0] * this.Bc[zoom]);
    var y = Math.round(d + 0.5 * Math.log((1 + f) / (1 - f)) * (-this.Cc[zoom]));
    (x > this.Ac[zoom]) && (x = this.Ac[zoom]);
    (y > this.Ac[zoom]) && (y = this.Ac[zoom]);
    //(x < 0) && (x = 0);
    //(y < 0) && (y = 0);
    return [x, y];
};

// Convert screen pixel value to lon lat
//
// - `px` {Array} `[x, y]` array of geographic coordinates.
// - `zoom` {Number} zoom level.
SphericalMercator.prototype.ll = function(px, zoom) {
    var g = (px[1] - this.zc[zoom]) / (-this.Cc[zoom]);
    var lon = (px[0] - this.zc[zoom]) / this.Bc[zoom];
    var lat = R2D * (2 * Math.atan(Math.exp(g)) - 0.5 * Math.PI);
    return [lon, lat];
};

// Convert tile xyz value to bbox of the form `[w, s, e, n]`
//
// - `x` {Number} x (longitude) number.
// - `y` {Number} y (latitude) number.
// - `zoom` {Number} zoom.
// - `tms_style` {Boolean} whether to compute using tms-style.
// - `srs` {String} projection for resulting bbox (WGS84|900913).
// - `return` {Array} bbox array of values in form `[w, s, e, n]`.
SphericalMercator.prototype.bbox = function(x, y, zoom, tms_style, srs) {
    // Convert xyz into bbox with srs WGS84
    if (tms_style) {
        y = (Math.pow(2, zoom) - 1) - y;
    }
    // Use +y to make sure it's a number to avoid inadvertent concatenation.
    var ll = [x * this.size, (+y + 1) * this.size]; // lower left
    // Use +x to make sure it's a number to avoid inadvertent concatenation.
    var ur = [(+x + 1) * this.size, y * this.size]; // upper right
    var bbox = this.ll(ll, zoom).concat(this.ll(ur, zoom));

    // If web mercator requested reproject to 900913.
    if (srs === '900913') {
        return this.convert(bbox, '900913');
    } else {
        return bbox;
    }
};

// Convert bbox to xyx bounds
//
// - `bbox` {Number} bbox in the form `[w, s, e, n]`.
// - `zoom` {Number} zoom.
// - `tms_style` {Boolean} whether to compute using tms-style.
// - `srs` {String} projection of input bbox (WGS84|900913).
// - `@return` {Object} XYZ bounds containing minX, maxX, minY, maxY properties.
SphericalMercator.prototype.xyz = function(bbox, zoom, tms_style, srs) {
    // If web mercator provided reproject to WGS84.
    if (srs === '900913') {
        bbox = this.convert(bbox, 'WGS84');
    }

    var ll = [bbox[0], bbox[1]]; // lower left
    var ur = [bbox[2], bbox[3]]; // upper right
    var px_ll = this.px(ll, zoom);
    var px_ur = this.px(ur, zoom);
    // Y = 0 for XYZ is the top hence minY uses px_ur[1].
    var bounds = {
        minX: Math.floor(px_ll[0] / this.size),
        minY: Math.floor(px_ur[1] / this.size),
        maxX: Math.floor((px_ur[0] - 1) / this.size),
        maxY: Math.floor((px_ll[1] - 1) / this.size)
    };
    if (tms_style) {
        var tms = {
            minY: (Math.pow(2, zoom) - 1) - bounds.maxY,
            maxY: (Math.pow(2, zoom) - 1) - bounds.minY
        };
        bounds.minY = tms.minY;
        bounds.maxY = tms.maxY;
    }
    return bounds;
};

// Convert projection of given bbox.
//
// - `bbox` {Number} bbox in the form `[w, s, e, n]`.
// - `to` {String} projection of output bbox (WGS84|900913). Input bbox
//   assumed to be the "other" projection.
// - `@return` {Object} bbox with reprojected coordinates.
SphericalMercator.prototype.convert = function(bbox, to) {
    if (to === '900913') {
        return this.forward(bbox.slice(0, 2)).concat(this.forward(bbox.slice(2,4)));
    } else {
        return this.inverse(bbox.slice(0, 2)).concat(this.inverse(bbox.slice(2,4)));
    }
};

// Convert lon/lat values to 900913 x/y.
SphericalMercator.prototype.forward = function(ll) {
    var xy = [
        A * ll[0] * D2R,
        A * Math.log(Math.tan((Math.PI*0.25) + (0.5 * ll[1] * D2R)))
    ];
    // if xy value is beyond maxextent (e.g. poles), return maxextent.
    (xy[0] > MAXEXTENT) && (xy[0] = MAXEXTENT);
    (xy[0] < -MAXEXTENT) && (xy[0] = -MAXEXTENT);
    (xy[1] > MAXEXTENT) && (xy[1] = MAXEXTENT);
    (xy[1] < -MAXEXTENT) && (xy[1] = -MAXEXTENT);
    return xy;
};

// Convert 900913 x/y values to lon/lat.
SphericalMercator.prototype.inverse = function(xy) {
    return [
        (xy[0] * R2D / A),
        ((Math.PI*0.5) - 2.0 * Math.atan(Math.exp(-xy[1] / A))) * R2D
    ];
};

return SphericalMercator;

})();

if (typeof module !== 'undefined' && typeof exports !== 'undefined') {
    module.exports = exports = SphericalMercator;
}

var SQLite = (function(exports) {
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

function makeEventEmitter(child) {
    var EE = typeof EventEmitter !== 'undefined' ? EventEmitter : process.EventEmitter;
    child.prototype = Object.create(EE.prototype, {
        constructor: { value: child, enumerable: false, writable: true, configurable: true }
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
function OverflowPage(no, db) {
    this.no = no;
    nonEnumerable(this, 'db', db);
}
makeEventEmitter(OverflowPage);

OverflowPage.prototype.setBuffer = function(buffer) {
    var data = new DataView(buffer, 0, 4);
    this.size = buffer.byteLength - this.db.reservedSpace - 4;
    this.right = data.getUint32(0);
    nonEnumerable(this, '_bytes', new Uint8Array(buffer, 4, this.size));
}


Page.BTree = BTreePage;
function BTreePage(no, db) {
    this.no = no;
    nonEnumerable(this, 'db', db);
}
makeEventEmitter(BTreePage);

BTreePage.prototype.setBuffer = function(buffer) {
    var data = new DataView(buffer);
    this.size = buffer.byteLength - this.db.reservedSpace;

    // Skip the database header on the first page.
    var offset = this.no == 1 ? 100 : 0;
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
        this.minLocal = this.db.minLeaf;
        this.maxLocal = this.db.maxLeaf;
    } else if (this.type !== TABLE_INTERIOR) {
        this.minLocal = this.db.minLocal;
        this.maxLocal = this.db.maxLocal;
    }

    nonEnumerable(this, '_data', data);
    nonEnumerable(this, '_bytes', new Uint8Array(buffer));
};

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
    var remaining = this.pointers.length, result = [];
    this.pointers.map(function(pointer, i) {
        page.getCellAt(pointer).getRecord(function(err, value) {
            if (err) { remaining = -1; return callback(err); }
            result[i] = value; remaining--;
            if (remaining === 0) callback(null, result);
        });
    });
};
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

return exports;
})({});
