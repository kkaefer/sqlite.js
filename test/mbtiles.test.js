var MBTiles = require('../demo/mbtiles');
var assert = require('assert');

var file1 = '/Users/kkaefer/Documents/MapBox/tiles/wider-circle/wider-circle-dc.mbtiles';
var file2 = '/Users/kkaefer/Documents/MapBox/tiles/mapbox/world-bright.mbtiles';

var mbtiles1, mbtiles2;

before(function(done) {
    mbtiles1 = new MBTiles(file1, function(err) {
        if (err) return done(err);
        mbtiles2 = new MBTiles(file2, done);
    });
});

describe('MBTiles', function() {
    it('should read the metadata table', function() {
        assert.deepEqual(mbtiles1.info, {
            scheme: 'tms',
            basename: 'wider-circle-dc.mbtiles',
            id: 'wider-circle-dc',
            filesize: 17387520,
            attribution: 'Certain data © OpenStreetMap contributors, CC-BY-SA',
            description: 'Light, clean baselayer for DC data overlays.',
            bounds: [ -77.1198, 38.7916, -76.9094, 38.9955 ],
            version: '1.0',
            type: 'baselayer',
            name: 'Wider Circle: DC Baselayer',
            minzoom: 0,
            maxzoom: 22,
            center: [ -77.0146, 38.893550000000005, 11 ]
        });
    });

    it('should get the center tile', function(done) {
        mbtiles1.getTile(13, 2342, 3133, done);
    });

    it('should return an error for a tile that does not exist', function(done) {
        mbtiles1.getTile(9, 10, 11, function(err) {
            assert.ok(err);
            assert.equal(err.message, 'Tile does not exist');
            done();
        });
    });

    it('should get a tile from a bigger db', function(done) {
        mbtiles2.getTile(0, 0, 0, done);
    });
});
