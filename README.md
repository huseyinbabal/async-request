# async-request
Async Request Demo Application written with Node.js

1. Set following Environment variables after creating [Github Application](https://github.com/settings/developers)
  2. **GITHUB_CLIENT_ID**
  3. **GITHUB_CLIENT_SECRET**

2. Configure endpoints in `config/default.json`

3. If you want to cache responses in Redis, define environment variable REDIS_URL(e.g. redis://127.0.0.1:6379)

3. Run `npm install && node server.js`

4. Call `http://<host>:<port>/api/<endpoint_name>`

**Evented Cache Expiration**

If you enable Redis by defining REDIS_URL environment variable, your responses will be cached to the redis. This application
listens a channel called **github** and whenever a message arrives to this channel, key will be extracted from message and
the value belongs to that key automatically expired from Redis. You can trigger expiration message by requesting endpoint
**/event/expire/:key**

