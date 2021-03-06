var assert = require('assert');
var sqlite = require('..');


describe('reading a file', function() {
    it('should read the table schema', function(done) {
        var db = new sqlite.Database('./test/fixtures/empty.sqlite');
        db.on('error', done);
        db.on('open', function() {
            assert.deepEqual(db.tables, {
                foo: { rootpage: 2, sql: 'CREATE TABLE foo (x, y, z)' },
                bar: { rootpage: 3, sql: 'CREATE TABLE bar (a INT)' }
            });
            done();
        });
    });

    it('should read a table', function(done) {
        var db = new sqlite.Database('./test/fixtures/empty.sqlite');
        db.on('error', done);
        db.on('open', function() {
            db.readTable('foo', function(err, rows) {
                if (err) return done(err);
                assert.deepEqual(rows, [ [ 1, 1, 2, 'bar' ] ]);
                done();
            });
        });
    });

    it('should read the table schema from a database with >1 schema pages', function(done) {
        var db = new sqlite.Database('./test/fixtures/lotsoftables.sqlite');
        db.on('error', done);
        db.on('open', function() {
            assert.deepEqual(db.tables, {
                a: { rootpage: 2, sql: 'CREATE TABLE a (a INTEGER, b INTEGER, c INTEGER, d INTEGER, e INTEGER, f INTEGER, g INTEGER, h INTEGER, i INTEGER, j INTEGER, k INTEGER, l INTEGER, m INTEGER, n INTEGER, o INTEGER, p INTEGER, q INTEGER, r INTEGER, s INTEGER, t INTEGER, u INTEGER, v INTEGER, w INTEGER, x INTEGER, y INTEGER, z INTEGER)' },
                b: { rootpage: 3, sql: 'CREATE TABLE b (a INTEGER, b INTEGER, c INTEGER, d INTEGER, e INTEGER, f INTEGER, g INTEGER, h INTEGER, i INTEGER, j INTEGER, k INTEGER, l INTEGER, m INTEGER, n INTEGER, o INTEGER, p INTEGER, q INTEGER, r INTEGER, s INTEGER, t INTEGER, u INTEGER, v INTEGER, w INTEGER, x INTEGER, y INTEGER, z INTEGER)' },
                c: { rootpage: 4, sql: 'CREATE TABLE c (a INTEGER, b INTEGER, c INTEGER, d INTEGER, e INTEGER, f INTEGER, g INTEGER, h INTEGER, i INTEGER, j INTEGER, k INTEGER, l INTEGER, m INTEGER, n INTEGER, o INTEGER, p INTEGER, q INTEGER, r INTEGER, s INTEGER, t INTEGER, u INTEGER, v INTEGER, w INTEGER, x INTEGER, y INTEGER, z INTEGER)' },
                d: { rootpage: 6, sql: 'CREATE TABLE d (a INTEGER, b INTEGER, c INTEGER, d INTEGER, e INTEGER, f INTEGER, g INTEGER, h INTEGER, i INTEGER, j INTEGER, k INTEGER, l INTEGER, m INTEGER, n INTEGER, o INTEGER, p INTEGER, q INTEGER, r INTEGER, s INTEGER, t INTEGER, u INTEGER, v INTEGER, w INTEGER, x INTEGER, y INTEGER, z INTEGER)' },
                e: { rootpage: 8, sql: 'CREATE TABLE e (a INTEGER, b INTEGER, c INTEGER, d INTEGER, e INTEGER, f INTEGER, g INTEGER, h INTEGER, i INTEGER, j INTEGER, k INTEGER, l INTEGER, m INTEGER, n INTEGER, o INTEGER, p INTEGER, q INTEGER, r INTEGER, s INTEGER, t INTEGER, u INTEGER, v INTEGER, w INTEGER, x INTEGER, y INTEGER, z INTEGER)' },
                f: { rootpage: 9, sql: 'CREATE TABLE f (a INTEGER, b INTEGER, c INTEGER, d INTEGER, e INTEGER, f INTEGER, g INTEGER, h INTEGER, i INTEGER, j INTEGER, k INTEGER, l INTEGER, m INTEGER, n INTEGER, o INTEGER, p INTEGER, q INTEGER, r INTEGER, s INTEGER, t INTEGER, u INTEGER, v INTEGER, w INTEGER, x INTEGER, y INTEGER, z INTEGER)' },
                g: { rootpage: 10, sql: 'CREATE TABLE g (a INTEGER, b INTEGER, c INTEGER, d INTEGER, e INTEGER, f INTEGER, g INTEGER, h INTEGER, i INTEGER, j INTEGER, k INTEGER, l INTEGER, m INTEGER, n INTEGER, o INTEGER, p INTEGER, q INTEGER, r INTEGER, s INTEGER, t INTEGER, u INTEGER, v INTEGER, w INTEGER, x INTEGER, y INTEGER, z INTEGER)' },
                h: { rootpage: 12, sql: 'CREATE TABLE h (a INTEGER, b INTEGER, c INTEGER, d INTEGER, e INTEGER, f INTEGER, g INTEGER, h INTEGER, i INTEGER, j INTEGER, k INTEGER, l INTEGER, m INTEGER, n INTEGER, o INTEGER, p INTEGER, q INTEGER, r INTEGER, s INTEGER, t INTEGER, u INTEGER, v INTEGER, w INTEGER, x INTEGER, y INTEGER, z INTEGER)' },
                i: { rootpage: 13, sql: 'CREATE TABLE i (a INTEGER, b INTEGER, c INTEGER, d INTEGER, e INTEGER, f INTEGER, g INTEGER, h INTEGER, i INTEGER, j INTEGER, k INTEGER, l INTEGER, m INTEGER, n INTEGER, o INTEGER, p INTEGER, q INTEGER, r INTEGER, s INTEGER, t INTEGER, u INTEGER, v INTEGER, w INTEGER, x INTEGER, y INTEGER, z INTEGER)' },
                j: { rootpage: 14, sql: 'CREATE TABLE j (a INTEGER, b INTEGER, c INTEGER, d INTEGER, e INTEGER, f INTEGER, g INTEGER, h INTEGER, i INTEGER, j INTEGER, k INTEGER, l INTEGER, m INTEGER, n INTEGER, o INTEGER, p INTEGER, q INTEGER, r INTEGER, s INTEGER, t INTEGER, u INTEGER, v INTEGER, w INTEGER, x INTEGER, y INTEGER, z INTEGER)' },
                k: { rootpage: 16, sql: 'CREATE TABLE k (a INTEGER, b INTEGER, c INTEGER, d INTEGER, e INTEGER, f INTEGER, g INTEGER, h INTEGER, i INTEGER, j INTEGER, k INTEGER, l INTEGER, m INTEGER, n INTEGER, o INTEGER, p INTEGER, q INTEGER, r INTEGER, s INTEGER, t INTEGER, u INTEGER, v INTEGER, w INTEGER, x INTEGER, y INTEGER, z INTEGER)' },
                l: { rootpage: 17, sql: 'CREATE TABLE l (a INTEGER, b INTEGER, c INTEGER, d INTEGER, e INTEGER, f INTEGER, g INTEGER, h INTEGER, i INTEGER, j INTEGER, k INTEGER, l INTEGER, m INTEGER, n INTEGER, o INTEGER, p INTEGER, q INTEGER, r INTEGER, s INTEGER, t INTEGER, u INTEGER, v INTEGER, w INTEGER, x INTEGER, y INTEGER, z INTEGER)' },
                m: { rootpage: 18, sql: 'CREATE TABLE m (a INTEGER, b INTEGER, c INTEGER, d INTEGER, e INTEGER, f INTEGER, g INTEGER, h INTEGER, i INTEGER, j INTEGER, k INTEGER, l INTEGER, m INTEGER, n INTEGER, o INTEGER, p INTEGER, q INTEGER, r INTEGER, s INTEGER, t INTEGER, u INTEGER, v INTEGER, w INTEGER, x INTEGER, y INTEGER, z INTEGER)' },
                n: { rootpage: 20, sql: 'CREATE TABLE n (a INTEGER, b INTEGER, c INTEGER, d INTEGER, e INTEGER, f INTEGER, g INTEGER, h INTEGER, i INTEGER, j INTEGER, k INTEGER, l INTEGER, m INTEGER, n INTEGER, o INTEGER, p INTEGER, q INTEGER, r INTEGER, s INTEGER, t INTEGER, u INTEGER, v INTEGER, w INTEGER, x INTEGER, y INTEGER, z INTEGER)' },
                o: { rootpage: 21, sql: 'CREATE TABLE o (a INTEGER, b INTEGER, c INTEGER, d INTEGER, e INTEGER, f INTEGER, g INTEGER, h INTEGER, i INTEGER, j INTEGER, k INTEGER, l INTEGER, m INTEGER, n INTEGER, o INTEGER, p INTEGER, q INTEGER, r INTEGER, s INTEGER, t INTEGER, u INTEGER, v INTEGER, w INTEGER, x INTEGER, y INTEGER, z INTEGER)' },
                p: { rootpage: 22, sql: 'CREATE TABLE p (a INTEGER, b INTEGER, c INTEGER, d INTEGER, e INTEGER, f INTEGER, g INTEGER, h INTEGER, i INTEGER, j INTEGER, k INTEGER, l INTEGER, m INTEGER, n INTEGER, o INTEGER, p INTEGER, q INTEGER, r INTEGER, s INTEGER, t INTEGER, u INTEGER, v INTEGER, w INTEGER, x INTEGER, y INTEGER, z INTEGER)' },
                q: { rootpage: 24, sql: 'CREATE TABLE q (a INTEGER, b INTEGER, c INTEGER, d INTEGER, e INTEGER, f INTEGER, g INTEGER, h INTEGER, i INTEGER, j INTEGER, k INTEGER, l INTEGER, m INTEGER, n INTEGER, o INTEGER, p INTEGER, q INTEGER, r INTEGER, s INTEGER, t INTEGER, u INTEGER, v INTEGER, w INTEGER, x INTEGER, y INTEGER, z INTEGER)' },
                r: { rootpage: 25, sql: 'CREATE TABLE r (a INTEGER, b INTEGER, c INTEGER, d INTEGER, e INTEGER, f INTEGER, g INTEGER, h INTEGER, i INTEGER, j INTEGER, k INTEGER, l INTEGER, m INTEGER, n INTEGER, o INTEGER, p INTEGER, q INTEGER, r INTEGER, s INTEGER, t INTEGER, u INTEGER, v INTEGER, w INTEGER, x INTEGER, y INTEGER, z INTEGER)' },
                s: { rootpage: 26, sql: 'CREATE TABLE s (a INTEGER, b INTEGER, c INTEGER, d INTEGER, e INTEGER, f INTEGER, g INTEGER, h INTEGER, i INTEGER, j INTEGER, k INTEGER, l INTEGER, m INTEGER, n INTEGER, o INTEGER, p INTEGER, q INTEGER, r INTEGER, s INTEGER, t INTEGER, u INTEGER, v INTEGER, w INTEGER, x INTEGER, y INTEGER, z INTEGER)' },
                t: { rootpage: 28, sql: 'CREATE TABLE t (a INTEGER, b INTEGER, c INTEGER, d INTEGER, e INTEGER, f INTEGER, g INTEGER, h INTEGER, i INTEGER, j INTEGER, k INTEGER, l INTEGER, m INTEGER, n INTEGER, o INTEGER, p INTEGER, q INTEGER, r INTEGER, s INTEGER, t INTEGER, u INTEGER, v INTEGER, w INTEGER, x INTEGER, y INTEGER, z INTEGER)' },
                u: { rootpage: 29, sql: 'CREATE TABLE u (a INTEGER, b INTEGER, c INTEGER, d INTEGER, e INTEGER, f INTEGER, g INTEGER, h INTEGER, i INTEGER, j INTEGER, k INTEGER, l INTEGER, m INTEGER, n INTEGER, o INTEGER, p INTEGER, q INTEGER, r INTEGER, s INTEGER, t INTEGER, u INTEGER, v INTEGER, w INTEGER, x INTEGER, y INTEGER, z INTEGER)' },
                v: { rootpage: 30, sql: 'CREATE TABLE v (a INTEGER, b INTEGER, c INTEGER, d INTEGER, e INTEGER, f INTEGER, g INTEGER, h INTEGER, i INTEGER, j INTEGER, k INTEGER, l INTEGER, m INTEGER, n INTEGER, o INTEGER, p INTEGER, q INTEGER, r INTEGER, s INTEGER, t INTEGER, u INTEGER, v INTEGER, w INTEGER, x INTEGER, y INTEGER, z INTEGER)' },
                w: { rootpage: 32, sql: 'CREATE TABLE w (a INTEGER, b INTEGER, c INTEGER, d INTEGER, e INTEGER, f INTEGER, g INTEGER, h INTEGER, i INTEGER, j INTEGER, k INTEGER, l INTEGER, m INTEGER, n INTEGER, o INTEGER, p INTEGER, q INTEGER, r INTEGER, s INTEGER, t INTEGER, u INTEGER, v INTEGER, w INTEGER, x INTEGER, y INTEGER, z INTEGER)' },
                x: { rootpage: 33, sql: 'CREATE TABLE x (a INTEGER, b INTEGER, c INTEGER, d INTEGER, e INTEGER, f INTEGER, g INTEGER, h INTEGER, i INTEGER, j INTEGER, k INTEGER, l INTEGER, m INTEGER, n INTEGER, o INTEGER, p INTEGER, q INTEGER, r INTEGER, s INTEGER, t INTEGER, u INTEGER, v INTEGER, w INTEGER, x INTEGER, y INTEGER, z INTEGER)' },
                y: { rootpage: 34, sql: 'CREATE TABLE y (a INTEGER, b INTEGER, c INTEGER, d INTEGER, e INTEGER, f INTEGER, g INTEGER, h INTEGER, i INTEGER, j INTEGER, k INTEGER, l INTEGER, m INTEGER, n INTEGER, o INTEGER, p INTEGER, q INTEGER, r INTEGER, s INTEGER, t INTEGER, u INTEGER, v INTEGER, w INTEGER, x INTEGER, y INTEGER, z INTEGER)' },
                z: { rootpage: 36, sql: 'CREATE TABLE z (a INTEGER, b INTEGER, c INTEGER, d INTEGER, e INTEGER, f INTEGER, g INTEGER, h INTEGER, i INTEGER, j INTEGER, k INTEGER, l INTEGER, m INTEGER, n INTEGER, o INTEGER, p INTEGER, q INTEGER, r INTEGER, s INTEGER, t INTEGER, u INTEGER, v INTEGER, w INTEGER, x INTEGER, y INTEGER, z INTEGER)' }
            });
            done();
        });
    });
});
