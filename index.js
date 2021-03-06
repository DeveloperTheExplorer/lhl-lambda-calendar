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

async function sendEmptyMail(person) {
    
    // send mail with defined transport object
    return transporter.sendMail({
        from: process.env.EMAIL, // sender address
        to: person.email, // list of receivers
        subject: `No Shifts For ${person.initials} | ${sheetName} LHL Schedule`, // Subject line
        text: `Hello! You have no shifts scheduled for this week. \n
        Please do not reply to this email. Thanks.`, // plain text body
        html: `<h2>You have no shifts for the period of ${sheetName}</h2><p>Hello! You have no shifts scheduled for this week.</p><p>Please <b>do not reply</b> to this email. Thanks.</p>`
    });
}

async function sendMail(content, person) {
    
    // send mail with defined transport object
    return transporter.sendMail({
        from: process.env.EMAIL, // sender address
        to: person.email, // list of receivers
        subject: `${person.initials} | ${sheetName} LHL Schedule`, // Subject line
        text: `Hello! Your shifts have been generated for the initials "${person.initials}" for the time period of ${sheetName}. \nTO SAVE SHIFTS TO CALENDAR CLICK ON "invite.ics" AND SAVE TO CALENDAR. \n
        Please do not reply to this email. Thanks.`, // plain text body
        html: `<h2>Shifts for the period of ${sheetName}</h2><p>Hello! Your shifts have been generated for the initials "${person.initials}" for the time period of ${sheetName}.</p><p>TO SAVE SHIFTS TO CALENDAR CLICK ON "invite.ics" AND SAVE TO CALENDAR.</p><p>Please <b>do not reply</b> to this email. Thanks.</p>`, // plain text body
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

    if (shifts.length === 0) {
        const res = await sendEmptyMail(person);

        console.log('res', res);
    }

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
        });
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
        service: 'Hotmail',
        auth: {
            user: process.env.EMAIL,
            pass: process.env.EMAIL_PASS
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