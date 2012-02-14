if (typeof process !== 'undefined' && typeof process.title !== 'undefined') {
    // node.js
    var SQLite = require('..');
    module.exports = MBTiles;
}

function MBTiles(file, callback) {
    var mbtiles = this;

    this.db = new SQLite.Database(file);
    this.db.on('error', function(err) {
        mbtiles.emit('error', err);
    });
    this.db.on('open', function() {
        mbtiles.stat = mbtiles.db.stat;
        mbtiles._getInfo(function(err) {
            if (err) return mbtiles.emit('error', err);
            if (callback) callback.call(mbtiles);
        });
    });
}

(function() {
    var EE = typeof EventEmitter !== 'undefined' ? EventEmitter : process.EventEmitter;
    MBTiles.prototype = Object.create(EE.prototype, {
        constructor: { value: MBTiles, enumerable: false, writable: true, configurable: true }
    });
})();


MBTiles.plans = {
    getTile: [
        { "type": "index", "name": "map_index" },
        { "type": "table", "name": "map", select: [4] },
        { "type": "index", "name": "images_id" },
        { "type": "table", "name": "images", select: [1] }
    ]
};

MBTiles.utils = {
    getMimeType: function(data) {
        if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4E &&
            data[3] === 0x47 && data[4] === 0x0D && data[5] === 0x0A &&
            data[6] === 0x1A && data[7] === 0x0A) {
            return 'image/png';
        } else if (data[0] === 0xFF && data[1] === 0xD8 &&
            data[data.length - 2] === 0xFF && data[data.length - 1] === 0xD9) {
            return 'image/jpeg';
        } else if (data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46 &&
            data[3] === 0x38 && (data[4] === 0x39 || data[4] === 0x37) &&
            data[5] === 0x61) {
            return 'image/gif';
        }
    }
}

MBTiles.prototype.getTile = function(z, x, y, callback) {
    if (!this.db.opened) return callback(new Error('MBTiles not yet loaded'));

    var mbtiles = this;
    // Flip Y coordinate because MBTiles files are TMS.
    y = (1 << z) - 1 - y;
    this.db.execute(MBTiles.plans.getTile, [z, x, y], function(err, result) {
        if (err) return callback(err);
        if (!result.length) return callback(new Error('Tile does not exist'));

        var options = {
            'Content-Type': MBTiles.utils.getMimeType(result[0]),
            'Last-Modified': new Date(mbtiles.stat.mtime).toUTCString()
        };

        return callback(null, result[0], options);
    });
};

MBTiles.prototype._getInfo = function(callback) {
    var mbtiles = this;
    this.db.readTable('metadata', function(err, rows) {
        if (err) return callback(err);

        var info = {};
        info.scheme = 'tms';
        info.basename = mbtiles.stat.name;
        info.id = mbtiles.stat.name.replace(/\.\w+$/, '');
        info.filesize = mbtiles.stat.size;

        for (var i = 0; i < rows.length; i++) {
            info[rows[i][1]] = rows[i][2];
        }

        // TODO: Determine minzoom/maxzoom if not present
        // TODO: Determine bounds if not present

        info.minzoom = parseInt(info.minzoom, 10);
        if (isNaN(info.minzoom) || typeof info.minzoom !== 'number') info.minzoom = 0;
        info.maxzoom = parseInt(info.maxzoom, 10);
        if (isNaN(info.maxzoom) || typeof info.maxzoom !== 'number') info.maxzoom = 22;

        if (info.bounds) info.bounds = info.bounds.split(',').map(parseFloat);
        if (info.center) info.center = info.center.split(',').map(parseFloat);

        var range = info.maxzoom - info.minzoom;
        if (!info.center && info.bounds) info.center = [
            (info.bounds[2] - info.bounds[0]) / 2 + info.bounds[0],
            (info.bounds[3] - info.bounds[1]) / 2 + info.bounds[1],
            (range <= 1) ? info.maxzoom : Math.floor(range * 0.5) + info.minzoom
        ];

        mbtiles.info = info;
        callback(null, info);
    });
};
