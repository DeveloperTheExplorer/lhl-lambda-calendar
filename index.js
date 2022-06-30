const { google } = require('googleapis');
const nodemailer = require('nodemailer');
const icalGenerator = require('ical-generator');
const db = require('./firebase');
const { 
    createDateRangeFromSheetData,
    extractTimesFromSheetData,
    formatIntoShifts,
    findAndReturnTheRightSheetName,
    defaultCalendarEvent
} = require('./utils/formatting');
require('dotenv').config();

// const ical = icalGenerator();
let sheetsAPI, transporter, sheetName, usersDB;

async function sendMail(content, person) {
    
    // send mail with defined transport object
    return transporter.sendMail({
        from: '"LHL Schedule 👻"', // sender address
        to: person.email, // list of receivers
        subject: `${person.initials} | ${sheetName} LHL Schedule`, // Subject line
        text: `Shifts generated for ${person.initials} for the time period of ${sheetName}. \nTO SAVE SHIFTS TO CALENDAR CLICK ON "invite.ics" AND SAVE TO CALENDAR. \n
        Please do not reply to this email. Thanks.`, // plain text body
        icalEvent: {
            filename: 'invite.ics',
            method: 'PUBLISH',
            content
        }
    });
}

const addShiftsToCalendar = async (person, shifts) => {
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
        const res = await sendMail(calEvent.toString(), person);
        console.log('res', res);
    } catch (error) {
        console.log('error:', error)
    }
}

const processSheetData = async (data) => {
    const sheetDates = data[0];
    const dateRanges = createDateRangeFromSheetData(sheetDates);
    const allShiftCells = extractTimesFromSheetData(data, dateRanges, usersDB);
    const allShiftsArr = Object.values(allShiftCells);
    
    try {
        for (const person of allShiftsArr) {
            const shifts = formatIntoShifts(person.shiftCells);
            
            await addShiftsToCalendar(person, shifts);
        }
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
    } catch(err) {
        console.log('err', err);
    }
}

const authenticate = async () => {
    const usersCollection = await db.collection('users');
    const usersData = await usersCollection.doc(process.env.FIREBASE_DATABASE_DOC_ID).get()
    const { users } = usersData.data();
    
    usersDB = users;

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