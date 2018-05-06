const {google} = require('googleapis');
const util = require('util');
const fs = require('fs');
const OAuth2Client = google.auth.OAuth2;
fs.readFileAsync = util.promisify(fs.readFile);
const titlecase = require('titlecase');
const escapeStringRegexp = require('escape-string-regexp');

const SPREADSHEET_ID = '11gTjAkpm4D3uoxnYCN7ZfbiVnKyi7tmm9Vp9HvTkGpw';
const TOKEN_PATH = 'secrets/credentials.json';
const SECRETS_PATH = 'secrets/client_secret.json';

/** authorize():
 * Authorizes Google credentials.
 * @return {google.auth.OAuth2} oAuth2Client
 **/
async function authorize() {
  let secrets;
  let token;
  try {
    secrets = await fs.readFileAsync(SECRETS_PATH);
    token = await fs.readFileAsync(TOKEN_PATH);
    const credentials = JSON.parse(secrets);
    const {client_secret, client_id, redirect_uris} = credentials.installed;
    const oAuth2Client = new OAuth2Client(
      client_id, client_secret, redirect_uris[0]);
    oAuth2Client.setCredentials(JSON.parse(token));
    return oAuth2Client;
  } catch (err) {
    console.log('Unable to open SECRETS_PATH or TOKEN_PATH', err);
  }
}

exports.speedrun = function lookupSpeedrun(
  msg, rows, category, secondaryCategory) {
  return new Promise((resolve, reject) => {
    const sheets = google.sheets({version: 'v4'});
    authorize()
      .then((oAuth2Client) => {
        category = escapeStringRegexp(category);
        category = category.toLowerCase();
        const categorySheet = getSheet(category);
        secondaryCategory = titlecase.toLaxTitleCase(secondaryCategory);
        const request = {
          spreadsheetId: SPREADSHEET_ID,
          range: categorySheet,
          auth: oAuth2Client,
        };
        sheets.spreadsheets.values.get(request, (err, {data}) => {
          if (err) {
            if (err.code === 400) {
              console.log(err.message);
              msg.channel.send(`Invalid speedrun category "${category}".`)
                .then((res) => {
                  resolve(res);
                  return;
                });
            } else {
              console.log(err);
              msg.channel.send(
                'The bot user has not set up valid Google API credentials yet.')
              .then((res) => {
                resolve(res);
                return;
              });
            }
          } else {
            // Find where the secondaryCategory is on the sheet in question
            console.log(data);
            const categoryRange = find(secondaryCategory, data.values);
            let categoryNames = [];
            // Get the row where the categories lie.
            const categoryRow = data.values[categoryRange.row + 1];
            // Start from the place where secondaryCategory was found,
            // Add 2 to categoryRow because the category rows are always going
            // to be 2 below the secondary category,
            // push secondaryCategory into cagetoryNames,
            // increment the place where secondaryCategory was found by one,
            // and keep going until we either hit a '' or undefined.
            for
            (let i = categoryRange.columnNum - 1; i < categoryRow.length; i++) {
              console.log(i);
              if (categoryRow[i] === undefined ||
                  categoryRow[i] === '' ||
                  categoryRow[i] === null) {
                break;
              }
              console.log(categoryRow[i]);
              categoryNames.push(categoryRow[i]);
            }
            // Now that we know the category names, we need to get the values of
            // the top {rows} contestants.
            // The contestants will always be in the row right below the
            // category
            let contestants = [];
            for (let i = categoryRange.row + 2; i <= rows; i++) {
              let contestant = [];
              for (let j = categoryRange.columnNum - 1;
                   j < categoryRow.length; j++) {
                     // the first criteria is always their name.
                     contestant.push(data.values[i][j]);
                   }
              contestants.push(contestant);
            }
            msg.channel.send(contestants)
              .then( (res) => {
                resolve(res);
            });
          }
        });
      });
  });
};

/** getSheet():
 *  returns a sheet based on the shorthand input the user provides.
 * @param {String} category: the category the user inputs.
 * @return {String} sheet
 **/
function getSheet(category) {
  switch (category) {
    case 'overall':
      category = 'GL 4* Overall rankings';
      break;
    case 'no-csb':
      category = 'GL 4* No CSB rankings';
      break;
    case 'cod':
      category = 'GL CoD Speedrun rankings';
      break;
    case 'magicite':
      category = '4* Magicite';
      break;
    default:
      category = titlecase.toLaxTitleCase(category);
    }
  return category;
}
 /**
 * Finds a value within a given range.
 * @see https://stackoverflow.com/questions/10807936/how-do-i-search-google-spreadsheets/10823543#10823543
 * @param {String} value The value to find.
 * @param {String} data The range to search in using Google's A1 format.
 * @return {Object} A range pointing to the first cell containing the value,
 *     or null if not found.
 */
function find(value, data) {
  for (let i = 0; i < data.length; i++) {
    for (let j = 0; j < data[i].length; j++) {
      if (data[i][j] == value) {
        const columnName = columnToName(j + 1);
        return {row: i + 1, column: columnName, columnNum: j + 1};
      }
    }
  }
  return null;
}
/**
 * Returns the Google Spreadsheet column name equivalent of a number.
 * @param {Integer} columnNumber The column number to look for
 * @return {String} columnName
 */
function columnToName(columnNumber) {
  let columnName = '';
  let modulo;
  const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  while (columnNumber > 0) {
    modulo = (columnNumber - 1) % 26;
    columnName = alpha.charAt(modulo) + columnName;
    columnNumber = Math.floor((columnNumber - modulo)/26);
  }
  return columnName;
}
