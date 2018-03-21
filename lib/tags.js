/**
 *
 * @param opts
 * @return {{ maxChars: String, allowRepeat: boolean }}
 */
function parseOptions(opts) {
    let defaultOpts = {
        maxChars: -1,
        maxTags: -1,
        allowRepeat: false
    };

    if (!opts) {
        opts = {}
    } else if (typeof opts === 'string') {
        opts = JSON.parse(opts)
    }

    return Object.assign(defaultOpts, opts);
}

function parseTags(val, el, e) {
    let opts = el.attr('data-options');

    opts = parseOptions(opts);

    let tags = val.replace(/\s/g, ',').replace(/,{2,}/g, ',').split(',');

    console.log(val.replace(/\s/g, ',') , tags);

    //Check char length
    if (opts.maxChars > 0) {
        for (let x = 0; x < tags.length; x++) {
            let t = tags[x];

            if (!t.isEmpty() && t.length > opts.maxChars && e.key !== ',' && e.key !== ' ') {
                return false;
            }
        }
    }

    let finalTags = [];
    for (let x = 0; x < tags.length; x++) {
        let t = tags[x];

        if (!t.isEmpty()) {
            if (opts.allowRepeat) {
                finalTags.push(t);
            } else if (!finalTags.includes(t)) {
                finalTags.push(t);
            }
        }
    }

    //Check tags length
    if (opts.maxTags > 0 && finalTags.length > opts.maxTags) {
        return false;
    }

    showTags(el, finalTags);
    return true;
}
/**
 *
 * @param {KeyboardEvent} e
 */
function onKeyPress(e) {

    let el = $('#' + e.target.id);

    let val = null;
    if (e.keyCode === 13 || e.keyCode === 8) {
        val = el.val();
    } else {
        val = el.val() + e.key;
    }

    return parseTags(val, el, e);
    
}

function removeTag(tag, inputTag) {
    let el = $('#' + inputTag);
    let val = el.val();
    val = val.replace(' ', ',').replace(tag, '').replace(/,{2,}/g, ',');
    parseTags(val, el, {key: null});
    el.val(val);
}

/**
 *
 * @param el
 * @param {Array} tags
 */
function showTags(el, tags) {

    let tagList = el.attr('tag-list');
    let id = el.attr('id');
    tagList = $('#' + tagList);

    tagList.html('');

    tags.forEach(function (tag) {
        tagList.append(
            `<button type="button" class="btn btn-primary button-tag-publish" translate="yes">
                    ${tag}
                    <span class="glyphicon glyphicon-remove" aria-hidden="true" onclick="removeTag('${tag}', '${id}')"></span>
                 </button>`
        )
    })

}

function tagsInit() {
    $('*[tags-view]').each(function () {
        let el = $(this);
        el.keypress(function (e) {
            return onKeyPress(e)
        }).on('keyup', function (e) {
            console.log(e)
            if (e.keyCode === 13 || e.keyCode === 8) {
                onKeyPress(e);
            }
        })
    })
}