const { google } = require('googleapis');
const { 
    createDateRangeFromSheetData,
    extractTimesFromSheetData,
    formatIntoShifts,
    defaultCalendarEvent
} = require('./utils/formatting');
require('dotenv').config();

let sheetsAPI, calendarAPI;

const addShiftsToCalendar = (shifts) => {
    const event = defaultCalendarEvent;
    const promises = [];

    for (const shift of shifts) {
        event.resource.start.dateTime = shift.startTime.toISOString();
        event.resource.end.dateTime = shift.endTime.toISOString();
        const stringifiedEvent = JSON.stringify(event);

        console.log('gapi.client', gapi.client);
        console.log('stringifiedEvent', stringifiedEvent);

        promises.push(
            gapi.client.calendar.events.insert(JSON.parse(stringifiedEvent))
        );

        // return gapi.client.calendar.events.insert(JSON.parse(stringifiedEvent))
    }

    return Promise.all(promises);
}

const processSheetData = (data) => {
    const sheetDates = data[0];
    const dateRanges = createDateRangeFromSheetData(sheetDates);
    const shiftCells = extractTimesFromSheetData(data, dateRanges);
    const shifts = formatIntoShifts(shiftCells);

    console.log('dateRanges', dateRanges);
    console.log('shiftCells', shiftCells);
    console.log('shifts', shifts);

    addShiftsToCalendar(shifts).then(
        (result) => console.log(result)
    );
}

// TODO: Find the latest range using dayjs
const getSpreadSheetData = async () => {
    const response = await sheetsAPI.spreadsheets.get({
        spreadsheetId: process.env.SPREADSHEET_ID,
        fields: 'namedRanges'
    })

    console.log('response', response);
}

const authenticate = async () => {
    const auth = new google.auth.GoogleAuth({
        keyFilename: './lhl-lambda-26f603cc5a32.json',
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

authenticate();

exports.handler = async (event) => {
    await authenticate();
    // TODO implement
    const response = {
        statusCode: 200,
        body: JSON.stringify('Hello from Lambda!'),
    };

    return response;
};