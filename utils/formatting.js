const dayjs = require('dayjs');
const weekOfYear = require('dayjs/plugin/weekOfYear');
require('dotenv').config();

dayjs.extend(weekOfYear);

const createDateRangeFromSheetData = (dateArr) => {
    const dateRanges = ['', ''];
    let currentDate = '';

    for (let i = 2; i < dateArr.length; ++i) {
        const currentCell = dateArr[i];

        if (currentCell.length > 0) {
            currentDate = currentCell;
        }
        dateRanges.push(currentDate);
    }

    return dateRanges;
}

const extractTimesFromSheetData = (arr2D, dateRanges) => {
    const arrStartIndex = 6;
    const arrEndIndex = 30;
    const shiftCells = [];

    for (let y = arrStartIndex; y < arrEndIndex; ++y) {
        const row = arr2D[y];
        let timePST = '';
        let time = '';
        let tz = '';

        for (let x = 0; x < row.length; ++x) {
            const cell = row[x];

            if (x === 0) {
                time = cell;
                tz = cell.split(' ')[1];

                continue;
            }

            if (x === 1) {
                timePST = cell;

                continue;
            }

            if (cell !== process.env.MENTOR_INITIALS) {
                continue;
            }

            const cellObj = {
                timezone: tz,
                time,
                timePST: Number(timePST),
                day: dateRanges[x]
            }

            shiftCells.push(cellObj);
        }
    }

    return shiftCells;
}

const formatIntoShifts = (shiftCells) => {
    const shifts = [];

    for (const shiftCell of shiftCells) {
        const shiftAlreadyCreated = shifts.find(
            (cell) => cell.day === shiftCell.day
        );

        if (shiftAlreadyCreated) {
            continue;
        }

        let startTime = 999;
        let endTime = 0;

        for (const otherCell of shiftCells) {
            if (otherCell.day !== shiftCell.day) {
                continue;
            }

            if (otherCell.timePST < startTime) {
                startTime = otherCell.timePST;
            }
            if (otherCell.timePST + 1 > endTime) {
                endTime = otherCell.timePST + 1;
            }
        };

        const shift = {
            startTime: dayjs(shiftCell.day).hour(startTime),
            endTime: dayjs(shiftCell.day).hour(endTime),
            day: shiftCell.day
        }

        shifts.push(shift);
    }

    return shifts;
}

const generateThisSchedulePeriod = () => {
    const currentWeek = dayjs().week();
    const delta = 0;
    const nextMonday = dayjs().week(currentWeek + delta).day(1);
    const nextSunday = nextMonday.add(6, 'day');

    return {
        startDay: nextMonday.format('D'),
        startMonth: nextMonday.format('MMM'),
        startYear: nextMonday.format('YYYY'),
        endDay: nextSunday.format('D'),
        endMonth: nextSunday.format('MMM')
    };
}

const findAndReturnTheRightSheetName = (namedRanges) => {
    const periodDates = generateThisSchedulePeriod();
    const periodDatesArr = Object.values(periodDates);

    console.log('periodDatesArr', periodDatesArr);

    for (const range of namedRanges) {
        const rangeName = range.name;
        let foundAllNames = true;

        for (const dateVal of periodDatesArr) {
            if (!rangeName.includes(dateVal)) {
                foundAllNames = false;
                break;
            }
        }
        
        if (!foundAllNames) {
            continue;
        }

        return rangeName.split('!')[0]; // get rid of any sheets commands in name
    }
}

const defaultCalendarEvent = {
    calendarId: process.env.CALENDAR_ID,
    resource: {
        summary: 'LHL Shift',
        start: {
            dateTime: '',
            timeZone: process.env.TIMEZONE
        },
        end: {
            dateTime: '',
            timeZone: process.env.TIMEZONE
        },
        reminders: {
            useDefault: false,
            overrides: [
                {
                    method: 'email',
                    minutes: 24 * 60
                },
                {
                    method: 'email',
                    minutes: 30
                }
            ]
        },
    },
}

module.exports = {
    createDateRangeFromSheetData,
    extractTimesFromSheetData,
    formatIntoShifts,
    findAndReturnTheRightSheetName,
    defaultCalendarEvent
}