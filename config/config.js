const { DateTime, Interval } = require('luxon');

const times= [
    { 
        present: {
            dates: Interval.fromDateTimes( 2020, 2040 ),
        }
    },
    {
        recentPast: {}
    },
    {
        nearFuture:{}
    }

];


const worlds= [
    {
        real: {}
    },
    {
        alternate: {}
    },
    {
        wheatland: {}
    }
]