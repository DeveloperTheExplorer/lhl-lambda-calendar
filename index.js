const { google } = require('googleapis');
const nodemailer = require('nodemailer');
const icalGenerator = require('ical-generator');
const { 
    createDateRangeFromSheetData,
    extractTimesFromSheetData,
    formatIntoShifts,
    findAndReturnTheRightSheetName,
    defaultCalendarEvent
} = require('./utils/formatting');
require('dotenv').config();

// const ical = icalGenerator();
let sheetsAPI, transporter, sheetName;

async function sendMail(subject, content) {
    
    // send mail with defined transport object
    return transporter.sendMail({
        from: '"LHL Schedule 👻"', // sender address
        to: `arvin.ansari68@gmail.com`, // list of receivers
        subject: `${subject} LHL Schedule`, // Subject line
        text: `${subject} LHL Schedule Calendar Invite`, // plain text body
        icalEvent: {
            filename: 'invite.ics',
            method: 'PUBLISH',
            content: content
        }
    });
}

const addShiftsToCalendar = async (shifts) => {
    const event = defaultCalendarEvent;
    let events = [];

    try {
        for (const shift of shifts) {
            event.start = shift.startTime;
            event.end = shift.endTime;
            
            events.push({
                ...event
            });
            
        }
        const calEvent = icalGenerator({
            domain: 'google.com',
            method: 'PUBLISH',
            prodId: '//Google Inc//Google Calendar 70.9054//EN',
            name: 'LHL Schedule',
            timezone: process.env.TIMEZONE,
            events
        })
        const res = await sendMail(`LHL Scheduler ${sheetName}`, calEvent.toString());
        console.log('res', res);
    } catch (error) {
        console.log('error:', error)
    }
}

const processSheetData = async (data) => {
    const sheetDates = data[0];
    const dateRanges = createDateRangeFromSheetData(sheetDates);
    const shiftCells = extractTimesFromSheetData(data, dateRanges);
    const shifts = formatIntoShifts(shiftCells);
    
    try {
        await addShiftsToCalendar(shifts);
    } catch (error) {
        console.log('error', error)
    }
}

// TODO: Find the latest range using dayjs
const getSpreadSheetData = async () => {
    try {
        const response = await sheetsAPI.spreadsheets.get({
            spreadsheetId: process.env.SPREADSHEET_ID,
            fields: 'namedRanges'
        });
        const namedRanges = response.data.namedRanges;
        sheetName = findAndReturnTheRightSheetName(namedRanges);

        console.log('sheetName', sheetName);

        const result = await sheetsAPI.spreadsheets.values.get({
            spreadsheetId: process.env.SPREADSHEET_ID,
            range: sheetName,
            majorDimension: 'ROWS'
        });

        await processSheetData(result.data.values);

        console.log('sheetName', sheetName);
    } catch(err) {
        console.log('err', err);
    }
}

const authenticate = async () => {
        const auth = new google.auth.GoogleAuth({
        keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly', 'https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/calendar.events']
    });
    const authClient = await auth.getClient();

    sheetsAPI = google.sheets({
        version: 'v4',
        auth: authClient
    });

    transporter = nodemailer.createTransport({
        service: 'Gmail',
        auth: {
            type: 'OAuth2',
            user: 'arvin.ansari68@gmail.com',
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            refreshToken: process.env.GOOGLE_REFERSH_TOKEN,
            expires: 1484314697598
        }
    });

    await getSpreadSheetData();
}

if (process.env.NODE_ENV === 'dev') {
    authenticate();
}

exports.handler = async (event) => {
    await authenticate();
    // TODO implement
    const response = {
        statusCode: 200,
        body: JSON.stringify('Hello from Lambda!'),
    };

    return response;
};