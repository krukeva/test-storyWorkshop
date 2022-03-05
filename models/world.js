const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const worldSchema = Schema({
    name:           { type: String, required: true },
    description:    { type: String, required: true },
});

worldSchema
.virtual('url')
.get( function() {
    return '/world/' + this._id;
});

module.exports = mongoose.model('World', worldSchema);