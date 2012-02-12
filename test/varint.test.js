var assert = require('assert');


function decode(content, position) {
    var result = content[position++];
    if (result > 0x7f) {
        result = result & 0x7f;
        for (var bytes = 1; content[position] > 0x7f && bytes < 8; bytes++) {
            result = result * 0x80 + (content[position++] & 0x7f);
        }
        result = result * (bytes == 8 ? 0x100 : 0x80) + content[position++];
    }

    return [ result, position ];
}

// function decode(c, p) {
//     var r, b;
//     if((r=c[p++])>0x7f){r=r&0x7f;for(b=1;c[p]>0x7f&&b<8;b++)r=r*0x80+(c[p++]&0x7f);r=r*(b==8?0x100:0x80)+c[p++];}
//     return [ r, p ];
// }



describe('varint decoding', function() {
    it('should decode a single byte varint', function() {
        assert.deepEqual([ 5, 1 ], decode(new Buffer([ 0x05 ]), 0));
        assert.deepEqual([ 8, 1 ], decode(new Buffer([ 0x08 ]), 0));
        assert.deepEqual([ 127, 1 ], decode(new Buffer([ 0x7F ]), 0));
    });

    it('should decode a two byte varint', function() {
        assert.deepEqual([ 692, 2 ], decode(new Buffer([ 0x85, 0x34 ]), 0));
        assert.deepEqual([ 5820, 2 ], decode(new Buffer([ 0xAD, 0x3C ]), 0));
        assert.deepEqual([ 6861, 2 ], decode(new Buffer([ 0xB5, 0x4D ]), 0));
        assert.deepEqual([ 16383, 2 ], decode(new Buffer([ 0xFF, 0x7F ]), 0));
    });

    it('should decode a longer varint', function() {
        assert.deepEqual([ 449902, 3 ], decode(new Buffer([ 0x9B, 0xBA, 0x6E ]), 0));
        assert.deepEqual([ 5570832, 4 ], decode(new Buffer([ 0x82, 0xD4, 0x82, 0x10 ]), 0));
        assert.deepEqual([ 5592403, 4 ], decode(new Buffer([ 0x82, 0xD5, 0xAA, 0x53 ]), 0));
    });
});
