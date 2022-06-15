const { google } = require('googleapis');
const { 
    createDateRangeFromSheetData,
    extractTimesFromSheetData,
    formatIntoShifts,
    findAndReturnTheRightSheetName,
    defaultCalendarEvent
} = require('./utils/formatting');
require('dotenv').config();

let sheetsAPI, calendarAPI;

const addShiftsToCalendar = async (shifts) => {
    const event = defaultCalendarEvent;

    try {
        for (const shift of shifts) {
            event.resource.start.dateTime = shift.startTime.toISOString();
            event.resource.end.dateTime = shift.endTime.toISOString();
            
            const stringifiedEvent = JSON.stringify(event);
            const res = await calendarAPI.events.insert(JSON.parse(stringifiedEvent));

            console.log('res', res);
        }
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
        const sheetName = findAndReturnTheRightSheetName(namedRanges);
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
    calendarAPI = google.calendar({
        version: 'v3',
        auth: authClient
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