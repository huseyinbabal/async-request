var express     = require('express');
var app         = express();
var bodyParser  = require('body-parser');
var logger      = require('morgan');

var Requester = require('./requester');
var requester = new Requester();


app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(logger('combined'));

var port = process.env.PORT || 5000;


var apiRouter = express.Router();

apiRouter.get('*', function(req, res, next) {
    requester.call(req, res, next);
});

var eventRouter = express.Router();

eventRouter.get("/expire/:key", function(req, res, next) {
    requester.redisClient.publish("github", JSON.stringify({key: req.params.key}));
    res.json({result: "Expiration event published"});
});

app.use('/api', apiRouter);
app.use('/event', eventRouter);



app.listen(port);
console.log('[INFO] API is running on port: ' + port);