const { DateTime } = require("luxon");

exports.formateDate = function( dateISO ) {
    return DateTime.fromISO( dateISO ).toLocaleString(DateTime.DATE_MED);
}

exports.formateDateTime = function( dateTimeISO ) {
    return DateTime.fromISO( dateTimeISO ).toLocaleString(DateTime.DATETIME_MED);
}

exports.extractDate = function( dateTimeISO ){
    return DateTime.fromISO(dateTimeISO).toISODate();
}

exports.extractTime = function( dateTimeISO ){
    return DateTime.fromISO(dateTimeISO).toFormat('HH:mm:ss');
}