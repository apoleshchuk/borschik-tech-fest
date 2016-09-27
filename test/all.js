'use strict';

const ASSERT = require('assert');

describe('FEST', function() {

    const PATH = require('path');
    const FS = require('fs');
    const BORSCHIK = require('borschik');

    const tech = PATH.resolve(__dirname, '../techs/fest.js');

    const TESTS = ['include', 'src'];

    TESTS.forEach((test) => {
        let file = PATH.resolve(__dirname, `${test}/${test}.xml`);
        let resFile = PATH.resolve(__dirname, `${test}/_${test}.xml`);
        let okFile = PATH.resolve(__dirname, `${test}/ok_${test}.xml`);

        it(test, function(cb) {
            BORSCHIK
                    .api({
                        'freeze': false,
                        'input': file,
                        'minimize': true,
                        'output': resFile,
                        'tech': tech
                    })
                    .then(function() {
                        try {
                            ASSERT.equal(
                                FS.readFileSync(resFile, 'utf-8'),
                                FS.readFileSync(okFile, 'utf-8')
                            );
                            cb();
                        } catch(e) {
                            cb(e);
                        }
                    })
                    .fail(cb);
        });
    });
});
