const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { DateTime } = require("luxon");

const eventSchema = Schema({
    name:           { type: String, required: true },
    description:    { type: String, required: true },
    startDateTime:  { type: String, required: true },       // Le type Date de Mongoose est trop limité; il n'y a pas l'heure apparemment 
    endDateTime:    { type: String, required: true },       // et pas de vérification automatique des mises à jour.
    parentId:       { type: Schema.Types.ObjectId, ref: 'Event'},
    isSequence:     { type: Boolean },
    isKey:          { type: Boolean },
});


// Permet de disposer du lien vers l'api pour cet évenement. (Je ne sais pas encore à quoi ça sert.)
eventSchema
.virtual('url')
.get( function() {
    return '/event/' + this._id;
});

eventSchema
.virtual('startDate')
.get( function() {
    return DateTime.fromISO(this.startDateTime).toISODate();
});

eventSchema
.virtual('endDate')
.get( function() {
    return DateTime.fromISO(this.endDateTime).toISODate();
});

eventSchema
.virtual('startTime')
.get( function() {
    return DateTime.fromISO(this.startDateTime).toFormat('HH:mm');
});

eventSchema
.virtual('endTime')
.get( function() {
    return DateTime.fromISO(this.endDateTime).toFormat('HH:mm');
});

eventSchema
.virtual('startDateTime_formated')
.get( function() {
    return DateTime.fromISO(this.startDateTime).toLocaleString(DateTime.DATETIME_MED);
});

eventSchema
.virtual('endDateTime_formated')
.get( function() {
    return DateTime.fromISO(this.endDateTime).toLocaleString(DateTime.DATETIME_MED);
});

eventSchema
.virtual('startDate_formated')
.get( function() {
    return DateTime.fromISO(this.startDateTime).toLocaleString(DateTime.DATE_MED);
});

eventSchema
.virtual('endDate_formated')
.get( function() {
    return DateTime.fromISO(this.endDateTime).toLocaleString(DateTime.DATE_MED);
});

module.exports = mongoose.model('Event', eventSchema);