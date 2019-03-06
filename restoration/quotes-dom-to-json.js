// Run this on https://web.archive.org/web/20071121142634/http://redrice.uni.cc/index.php/quotes

console.clear();

r = Array.from($$('.news')).map(quote => {
    return {
        "id": parseInt(quote.id.substring(1), 10),
        commentCount: parseInt((quote.querySelector('.linkToComments a').textContent.match(/komentarze? \((.*)\)/) || [])[1], 10),
        "parent_id": null,
        "root": "quotes",
        "user": quote.querySelector('.newsUser').textContent,
        "nick": quote.querySelector('.newsNick').textContent,
        "date": quote.querySelector('.newsInfo').textContent.match(/[0-9]{4}[0-9: -]*/)[0],
        "host": undefined,
        "agent": undefined,
        "title": quote.querySelector('.newsTitle a').innerHTML,
        "content": quote.querySelector('.newsContent').innerHTML
    };
});

copy(r)
