#!/usr/bin/env node

const fsNP = require('fs');
const fs = fsNP.promises;
const path = require('path');
const { slugify }  = require('transliteration');

console.log();

const commentsData = require(__dirname + '/comments_data.json');
const commentsDataAllQuoteRows = commentsData.rows.filter(r => r.root === 'quotes').reverse();
console.log(`${commentsDataAllQuoteRows.length} rows from database dump`);

const commentsDataQuotes = commentsDataAllQuoteRows.filter(r => ! r.parent_id);
console.log(`${commentsDataQuotes.length} quotes from database dump`);
const commentsDataComments = commentsDataAllQuoteRows.filter(r => r.parent_id);
console.log(`${commentsDataComments.length} comments from database dump`);

const archiveOrgData = require(__dirname + '/archive.org.json');
console.log(`${archiveOrgData.length} rows from archive.org`);
const archiveOrgDataCommentCount = archiveOrgData.reduce(
    (count, q) => count + q.commentCount, 0
);
console.log(`${archiveOrgDataCommentCount} comments counted from archive.org`);

const archiveOrgNewData = archiveOrgData.filter(
    q => -1 === commentsDataQuotes.findIndex(qq => qq.id == q.id)
);
console.log(`${archiveOrgNewData.length} new rows from archive.org`);
const archiveOrgNewDataCommentCount = archiveOrgNewData.reduce(
    (count, q) => count + q.commentCount, 0
);
console.log(`${archiveOrgNewDataCommentCount} comments counted from new rows from archive.org`);


const quotes = [].concat(commentsDataQuotes, archiveOrgNewData);
console.log(`${quotes.length} quotes in total`);

let commentsDataCommentsAddedCount = 0;
function commentsDataAddComments (node)
{
    node.comments = node.comments || [];
    commentsDataComments.forEach(comment => {
        if (comment.parent_id === node.id)
        {
            //console.log(`${comment.id} is a comment for ${node.id}`);
            node.comments.push(comment);
            commentsDataCommentsAddedCount += 1;
            commentsDataAddComments(comment);
        }
    });
}
quotes.forEach(commentsDataAddComments);
console.log(`${commentsDataCommentsAddedCount} comments added to quotes from database dump ${commentsDataCommentsAddedCount === commentsDataComments.length ? '👍' : '👎'}`);

archiveOrgData.forEach(aQuote => { aQuote.comments.forEach(aComment => {
    const quote = quotes.find(q => q.id === aQuote.id);
    if (-1 === quote.comments.findIndex(c => c.id === aComment.id))
    {
        quote.comments.push(aComment);
    }
}); });

const commentsTotal = quotes.reduce(
    (count, q) => count + q.comments.length, 0
);
console.log(`${commentsTotal} comments in total ${commentsTotal === archiveOrgDataCommentCount ? '👍' : '👎'}`);


//process.stdout.write(JSON.stringify(quotes, null, 2));


const duplicates = [];
const files = new Map();

function escYamlValue (value)
{
    return `"${String(value || '').replace(/"/g, '\\"')}"`;
}

function escHtml (html)
{
    return html.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function nl2br (content)
{
    return content.replace(/\r?\n/g, '<br>\n');
}

function renderIrcQuote (quote)
{
    return `\n<blockquote><tt>${quote}</tt></blockquote>\n`;
}

function bb (content)
{
    return content
        .replace(/ class="biki"/gsm, '')
        .replace(/<span style="color: gray;" class="biki color">\(\.\.\)<\/span>/gsm, '(..)')
        .replace(/<blockquote class="biki (?:irc)?quote"><cite><\/cite>(.*?)<\/blockquote>/gsm, (_, q) => renderIrcQuote(q))
        .replace(/\[ircquote\](.*?)\[\/ircquote\]/gsm, (_, q) => renderIrcQuote(nl2br(escHtml(q))))
        .replace(/\[quote\]\s*\[code\](.*?)(\[\/code\]\s*\[\/quote\]|\[\/quote\]\s*\[\/code\])/gsm, (_, q) => renderIrcQuote(nl2br(escHtml(q))))
        .replace(/\[url=([^\]]+)\](.*?)\[\/url\]/gsm, '[$2]($1)')
}

function dataToTemplate (basePath, quote)
{
    let date;
    if (Number.isInteger(quote.date))
    {
        date = new Date(quote.date * 1000);
    }
    else
    {
        date = new Date(`${quote.date}`);
    }
    const dateFormatted = [
        date.getFullYear(),
        '-',
        String(date.getMonth() + 1).padStart(2, 0),
        '-',
        String(date.getDate()).padStart(2, 0),
        'T',
        String(date.getHours()).padStart(2, 0),
        ':',
        String(date.getMinutes()).padStart(2, 0),
        ':',
        String(date.getSeconds()).padStart(2, 0),
        ' CEST' // works fine with winter dates as well
    ].join('');
    const frontMattersData = {
        layout: 'quote',
        date: dateFormatted,
        title: bb(quote.title.trim()),
        citedAuthor: quote.nick,
        author: quote.user,
        legacyCommentId: quote.id,
        legacyHost: quote.host,
        legacyUserAgent: quote.agent,
    };

    const content = bb(quote.content.trim());

    const frontMatters = Object.entries(frontMattersData)
        .map(([name, value]) => `${name}: ${escYamlValue(value)}`)
        .join('\n');

    const postFileName = [
        date.getFullYear(),
        '-',
        String(date.getMonth() + 1).padStart(2, 0),
        '-',
        String(date.getDate()).padStart(2, 0),
        '-',
        String(date.getHours()).padStart(2, 0),
        ':',
        String(date.getMinutes()).padStart(2, 0),
        ':',
        String(date.getSeconds()).padStart(2, 0),
        '-',
        slugify(quote.title).replace(/[-_.]+/g, '-').replace(/-$/, '') || 'quote',
    ].join('');

    const postFilePath = `${basePath}/${postFileName}`;

    quote.fileName = postFileName;

    if (files.has(postFilePath))
    {
        duplicates.push(`id=${quote.id}: ${postFilePath}`);
    }

    const post = `---\n${frontMatters}\n---\n\n${content}`;
    files.set(postFilePath, post);
}

quotes.forEach(quote => {
    dataToTemplate(`quotes/_posts/`, quote);
    quote.comments.forEach(comment => {
        dataToTemplate(`quotes/comments/${quote.fileName}/_posts/`, comment);
    });
});
//process.stdout.write(JSON.stringify(quotes, null, 2));

if (duplicates.length)
{
    console.error(`Duplicate post file names:\n${duplicates.join('\n')}`);
    process.exit(1);
}

const filesArray = Array.from(files.entries());

(async function () {

    console.log(`Writing ${filesArray.length} files`);
    await Promise.all(filesArray.map(
        async ([fileName, post]) => {
            const filePath = `${__dirname}/../${fileName}.md`;
            const dirPath = path.dirname(filePath);
            if (! fsNP.existsSync(dirPath))
            {
                fsNP.mkdirSync(dirPath, { recursive: true });
            }
            try
            {
                //console.log(filePath);
                return await fs.writeFile(filePath, post);
            }
            catch (error)
            {
                console.error('FAILED TO WRITE:', filePath, post);
                throw error;
            }
        }
    ));

    console.log('Done');

}()).catch(error => {
    console.error(error);
    process.exit(1);
});
