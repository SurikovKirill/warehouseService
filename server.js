const express = require('express');
const MongoClient = require('mongodb').MongoClient;
const BodyParser = require('body-parser');
const app = express();
const route = require("./app/routes.js");
const reciever = require("./app/reciever.js")
const Eureka = require('eureka-js-client').Eureka;

const port = 3000;
const url = 'mongodb://localhost:27017';
const dbName = 'warehouse';
const client = new MongoClient(url);
client.connect();
const log4js = require('log4js');
log4js.configure({
    appenders: { fileAppender: { type: 'file', filename: 'events.log' } },
    categories: { default: { appenders: ['fileAppender'], level: 'info' } }
});
const logger = log4js.getLogger('server');


app.use(BodyParser.urlencoded({ extended: true }));


const clientEureca = new Eureka({
    instance: {
        app: 'warehouse-service',
        hostName: 'localhost',
        ipAddr: '127.0.0.1',
        vipAddress: 'warehouse-service',
        dataCenterInfo: {
            name: 'MyOwn',
        },
        dataCenterInfo: {
            '@class': 'com.netflix.appinfo.InstanceInfo$DefaultDataCenterInfo',
            name: 'MyOwn',
          },
        port:{
            '$': 3000,
            '@enabled': true,
        },
        statusPageUrl: 'http://localhost:3000'
    },
    eureka: {
        /* serviceUrls:{
             default: [ 
                 'http://localhost:8085/eureka'
             ]
         }*/
        host: '127.0.0.1',
        port: 8085,
        servicePath: '/eureka/apps',
        registerWithEureka: true,
        fetchRegistry: true
    },
});

clientEureca.start(error => {
    console.log(error || 'eureca started');
});




MongoClient.connect(url, function (err, database) {
    if (!err) {
        console.log("DB is connected");
    }
    const db = database.db(dbName);
    route(app, db, client, logger);
    reciever(db, client, logger);
    app.listen(port, () => {
        console.log('hello: ' + port);
    });
});








