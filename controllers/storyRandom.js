const Story = require('../models/story');
const World = require('../models/world');
const Event = require('../models/event');

exports.story_random = async function(req, res) {

    const { 
        theStory,
        coveringEvent,
        keyEventsAsEvents,
        SequencesAsEvents,
        myEvents
    } = require('./newScenario.js');

/*    res.json([
        theStory,
        coveringEvent,
        keyEventsAsEvents,
        SequencesAsEvents,
        myEvents
    ])
*/
    // Il faut choisir un monde
    let theWorld = await World.findOne();
    theStory.world = theWorld._id
    let myStory = new Story( theStory );

    try{
        myStory.save();
        coveringEvent.save();
        for (let i=0; i<SequencesAsEvents.length; i++) {
            SequencesAsEvents[i].save();
            keyEventsAsEvents[i].save();
        }
        res.redirect(myStory.url);
    } catch {
        res.send('Il y a un problème');
    }
}