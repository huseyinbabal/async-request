var express    = require('express');
var app        = express();
var bodyParser = require('body-parser');
var logger     = require('morgan');
var _          = require('underscore');
var config     = require('config');
var async      = require('async');
var https       = require('https');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(logger('combined'));

var port = process.env.PORT || 5000;


var router = express.Router();

router.get('*', function(req, res, next) {

    var endpointName = req.url.substring(1);
    if (typeof config.endpoints[endpointName] === 'undefined') {
        res.json({result: "Cannot map to endpoint"})
    } else {
        var endpointCalls = _.map(config.endpoints[endpointName].repos, function(repo, user) {
            return function(callback) {
                var content = "";
                var options = {
                    host: config.endpoints[endpointName].host,
                    port: 443,
                    path: repo + "?client_id=" + process.env.GITHUB_CLIENT_ID + "&client_secret=" + process.env.GITHUB_CLIENT_SECRET,
                    method: "GET",
                    headers: {'user-agent': 'Mozilla/5.0'}
                };
                https.get(options, function (resource) {
                    console.log("Fetching repository from Github for: " + user);
                    resource.setEncoding('utf8');
                    resource.on('data', function (data) {
                        content += data;
                    }).on('end', function(data) {
                        var repoObj = {}
                        repoObj[user] = JSON.parse(content);
                        callback(null, repoObj);
                    })
                });
            };
        });

        async.parallel(endpointCalls, function(err, results) {
            res.json({result: results});
        });
    }
});

app.use('/api', router);

app.listen(port);
console.log('API is running on port: ' + port);