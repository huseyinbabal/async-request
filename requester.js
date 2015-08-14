var crypto      = require('crypto');
var _           = require('underscore');
var config      = require('config');
var async       = require('async');
var https       = require('https');



function Requester() {
    this.isRedisEnabled = true,
    this.redisClient;
    this.redisSubscriberClient;
    this.CACHE_EXPIRE_TIME_IN_SECONDS = 60 * 60;
    this.initRedis();
}

Requester.prototype.doRequest = function(req, res, next) {
    var self = this;
    var redisParams = self.redisParams(req);
    var endpointName = redisParams.endpointName;
    var redisKey = redisParams.redisKey;

    if (typeof config.endpoints[endpointName] === 'undefined') {
        res.status(404).json({result: "Cannot map to endpoint"})
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
                        var repoData = _.map(JSON.parse(content), function(value, key) {
                            return new Object({name: value.name, star: value.stargazers_count});
                        });
                        repoObj[user] = repoData;
                        callback(null, repoObj);
                    })
                });
            };
        });

        async.parallel(endpointCalls, function(err, results) {
            self.redisSet(redisKey, JSON.stringify(results));
            res.json({result: results});
        });
    }
};

Requester.prototype.call = function(req, res, next) {
    var self = this;
    if (self.isRedisEnabled) {
        var redisKey = self.redisParams(req).redisKey;
        self.redisClient.get(redisKey, function(err, result) {
            if (err) console.log("[ERROR] " + err);
            if (result == null) {
                self.doRequest(req, res, next);
            } else {
                console.log("[INFO] " + redisKey + " found in Redis");
                res.json({result: JSON.parse(result)});
            }
        });
    } else {
        self.doRequest(req, res, next);
    }
};

Requester.prototype.redisSet = function(key, val) {
    if (this.isRedisEnabled) this.redisClient.set(key, val, "ex", this.CACHE_EXPIRE_TIME_IN_SECONDS);
};

Requester.prototype.enableRedis = function() {
    this.isRedisEnabled = true;
};

Requester.prototype.disableRedis = function() {
    this.isRedisEnabled = false;
};

Requester.prototype.initRedis = function() {
    var self = this;
    if (process.env.REDIS_URL) {
        console.log("[INFO] REDIS_URL found, attempting to run with Redis cache");
        var Redis = require('ioredis');
        self.redisClient = new Redis(process.env.REDIS_URL);

        self.redisClient.on("connect", function() {
            console.log("[INFO] Successfully connected to Redis");
        });

        self.redisClient.on("ready", function() {
            console.log("[INFO] Redis is ready to handle received commands");
            self.redisSubscriberClient = new Redis(process.env.REDIS_URL);
            self.redisSubscriberClient.subscribe("github", function(err, count) {
                if (!err) {
                    console.log("[INFO] Subscibed to github channel to expire cache on new updates")
                    self.redisSubscriberClient.on('message', function (channel, message) {
                        console.log('Receive message %s from channel %s', message, channel);
                        if (channel == "github") {
                            var msg = JSON.parse(message);
                            self.redisClient.expire(msg.key, 1);
                        }
                    });
                } else {
                    console.log("[ERROR] Cannot subscibe to channel github: " + err);
                }
            });
        });

        self.redisClient.on("error", function(err) {
            this.disableRedis();
            console.log("[ERROR] " + err);
        });
    } else {
        self.disableRedis();
        console.log("[INFO] REDIS_URL not found, running without Redis cache");
    }
};

Requester.prototype.redisParams = function(req) {
    var reqUrl = req.url;
    var endpointName = reqUrl.substring(1);
    var redisKey = crypto.createHash('md5').update(reqUrl).digest("hex");
    return {
        redisKey: redisKey,
        endpointName: endpointName,
        reqUrl: reqUrl
    };
};

module.exports = exports = Requester;