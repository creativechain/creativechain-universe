
function translate() {
    $('*[translate="yes"]').each(function () {
        let text = $(this).text();
        if (text && text.length > 0) {
            text = text.trim();
            if (lang[text]) {
                $(this).html(lang[text]);
            }
        }

        text = $(this).attr('placeholder');
        if (text && text.length > 0) {
            text = text.trim();
            if (lang[text]) {
                $(this).attr('placeholder', lang[text]);
            }
        }

    })
};
