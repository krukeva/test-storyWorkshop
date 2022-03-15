const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const storyTemplateSchema = Schema({
    name:           { type: String, required: true },
    description:    { type: String, required: true },
    sequences:      [ Schema.Types.Mixed ],
});

storyTemplateSchema
.virtual('url')
.get( function() {
    return '/storytemplate/' + this._id;
});

storyTemplateSchema
.virtual('numberOfSequences')
.get( function() {
    if ( this.sequences ){
        return this.sequences.length;
    }
});

module.exports = mongoose.model('StoryTemplate', storyTemplateSchema);