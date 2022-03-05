const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const storySchema = Schema({
    title: { type: String, required: true },
    world: { type: Schema.Types.ObjectId, ref: 'World'},
    coveringEvent: { type: Schema.Types.ObjectId, ref: 'Event'}
})

storySchema
.virtual('url')
.get( function() {
    return '/story/' + this._id;
});

module.exports = mongoose.model('Story', storySchema);