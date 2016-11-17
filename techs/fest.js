'use strict';

const FS = require('fs');
const CSSBASE = require('borschik/lib/techs/css-base');
const FREEZE = require('borschik/lib/freeze');
const U = require('borschik/lib/util');

const uniqStr = `${String.fromCharCode(0)}borschik${String.fromCharCode(0)}`;


const stringRe = "(?:(?:'[^'\\r\\n]*')|(?:\"[^\"\\r\\n]*\"))";
const attrsRe = "([^>]*)";

const parsedAttrRe = "(?:(src|href|background)\\s*(=|:)\\s*(" + stringRe + "))";

const commentRe = "(?:<!-->|<!--[^\\[<][\\s\\S]*?-->)";
const templateRe = "(?:<fest:template" + attrsRe + ">\\n?|<\\/fest:template>)\\n?";
const includeRe = "(?:<fest:(include|insert)" + attrsRe + ">)";

const allIncRe = new RegExp(commentRe + '|' + templateRe + '|' + includeRe + '|' + parsedAttrRe, 'g');
const attrRe = new RegExp("\\s+([a-z_:\\-]+)\\s*=\\s*(" + stringRe + ")", 'gim');


exports.Tech = CSSBASE.Tech.inherit({

    minimize: function(content) {
        return content;
    },

    File: exports.File = CSSBASE.File.inherit({

        parseInclude: function(content) {
            let includes = [];
            let _this = this;

            let text = content instanceof Buffer ? content.toString('utf-8') : content;

            let texts = text
                .replace(allIncRe, function(_, templateAttrs, includeType, includeAttrs, attr, attrSeparator, src) {
                    if (includeType && includeAttrs) {
                        // fest:include
                        let attrs = parseAttrs(includeAttrs);
                        let url = attrs.src;
                        let absPath = _this.pathTo(url);
                        let tech = _this.tech;
                        let chunk = {
                            url: url
                        };

                        // check for duplicates
                        if (absPath in tech.processedFiles) {
                            if (tech.opts.warnings) {
                                console.warn('*** WARNING', absPath + ' was already included in ' + tech.processedFiles[absPath] + ' and will be skipped.');
                            }
                            chunk.type = 'duplicate';
                        } else {
                            // save included path to check duplicates
                            tech.processedFiles[absPath] = _this.path;
                            chunk.type = 'include';
                            chunk.includeType = includeType;
                        }

                        includes.push(chunk);
                    } else if (attr && src && (src = parseUrl(src)) && U.isLinkProcessable(src) && _this.isFreezableUrl(src)) {
                        includes.push({
                            url: _this.pathTo(src),
                            type: attr,
                            separator: attrSeparator
                        });
                    } else {
                        includes.push({
                            file: _,
                            type: /^<\/?fest:template/.test(_) ? 'template' : 'comment'
                        });
                    }

                    return uniqStr;

                })
                .split(uniqStr);

            // zip texts and includes
            var res = [], t, i;
            while((t = texts.shift()) != null) {
                t && res.push(t);
                (i = includes.shift()) && res.push(i);
            }

            return res;
        },

        processInclude: function(path, content) {
            var parsed = content || this.content;

            for(var i = 0; i < parsed.length; i++) {
                var item = parsed[i];

                if (typeof item == 'string') {
                    continue;
                }

                if (item.type === 'duplicate' || (item.type === 'template' && this.parent)) {
                    parsed[i] = '';
                    continue;
                }

                if (item.type === 'include') {
                    let processed = this.child('include', item.url).process(path);
                    if (item.includeType == 'insert') {
                        parsed[i] = escapeJS(processed);
                    } else if (this.tech.opts.comments) {
                        parsed[i] = commentsWrap(processed, item.url);
                    } else {
                        parsed[i] = processed;
                    }
                    continue;
                }

                if (item.type == 'href' || item.type == 'src' || item.type == 'background') {
                    // freeze images with cssBase.processLink
                    parsed[i] = item.type + item.separator + this.child(item.type, item.url).process(path);
                } else {
                    parsed[i] = item.file;
                }
            }

            return parsed.join('');
        },

        processPath: function(path) {
            return path.replace(/^(.*?)(\?|$)/, '$1');
        },

        isFreezableUrl: function(url) {
            return FS.existsSync(this.path) && FREEZE.isFreezableUrl(url);
        }

    })
});


function parseUrl(url) {
    if (url.charAt(0) === '\'' || url.charAt(0) === '"') {
        url = url.substr(1, url.length - 2);
    }

    return url;
}

function parseAttrs(str) {
    let attrs = {};
    let m, v;

    while(m = attrRe.exec(str)) {
        v = m[2];
        if (v.charAt(0) === '\'' || v.charAt(0) === '"') {
            v = v.substr(1, v.length - 2);
        }

        attrs[m[1]] = v;
    }

    return attrs;
}


function commentsWrap(content, file) {
    return `\n<!-- fest-file-begin:${file} -->\n${content}\n<!-- fest-file-end:${file} -->\n`;
}

var jschars=/[<>]/g;
var jshash = {
	"<" :"&lt;",
	">" :"&gt;"
};

function escapeJS(s) {
	return s.replace(jschars, function (chr) {
		return jshash[chr];
	});
}
