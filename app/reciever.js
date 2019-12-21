var amqp = require('amqplib/callback_api');
var ObjectID = require('mongodb').ObjectID;

module.exports = function (db, client) {

    amqp.connect('amqp://localhost', function (error0, connection) {
        if (error0) {
            throw error0;
        }

        connection.createChannel(function (error1, channel) {
            if (error1) {
                throw error1;
            }
            const commandEx = 'warehouseCommandExchange';
            const eventEx = 'statusExchange';

            channel.assertExchange(eventEx, 'fanout', {
                durable: true
            });
            channel.assertExchange(commandEx, 'direct', {
                durable: true
            });

            channel.assertQueue('', {
                exclusive: true
            }, function (error2, q) {
                if (error2) {
                    throw error2;
                }
                console.log('waiting for commands');


                channel.bindQueue(q.queue, commandEx, 'whcKey');
                channel.consume(q.queue, async function (message) {

                    if (message.content) {

                        const messageData = JSON.parse(message.content.toString());
                        const info = { 'id': +messageData.id };
                        const wareData = await db.collection('warehousecollection').findOne(info);
                        console.log(wareData);
                        const amount = messageData.amount;
                        const session = client.startSession();
                        const transactionOptions = {
                            readPreference: 'primary',
                            readConcern: { level: 'local' },
                            writeConcern: { w: 'majority' }
                        };
                        try {
                            await session.withTransaction(async () => {

                                if (wareData.amount < amount) {
                                    res.send('товара нет на складе в таком количестве')
                                } else {

                                    await db.collection('reservecollection').updateOne(
                                        {
                                            orderID: messageData.orderID,
                                            returned: 'false'
                                        },
                                        { $push: { items: { id: +messageData.id, amount: amount } } },
                                        { upsert: true /*, session*/ });

                                    await db.collection('warehousecollection').update(
                                        info, {
                                        $inc: { amount: -amount }
                                    });

                                };


                            }, transactionOptions);
                        } finally {
                            await session.endSession();
                        }

                    }
                }, {
                    noAck: true
                });
            });


            channel.assertQueue('', {
                exclusive: true
            }, function (error2, q) {
                if (error2) {
                    throw error2;
                }
                console.log('waiting for events');
                channel.bindQueue(q.queue, eventEx, '');

                channel.consume(q.queue, async function (message) {
                    if (message.content) {

                        const messageData = JSON.parse(message.content.toString());
                        console.log(messageData);
                        if (messageData.status === 'FAILED') {
                            const session = client.startSession();
                            const transactionOptions = {
                                readPreference: 'primary',
                                readConcern: { level: 'local' },
                                writeConcern: { w: 'majority' }
                            };
                            try {
                                await session.withTransaction(async () => {
                                    const info = await db.collection('reservecollection').findOneAndUpdate(
                                        { "orderID": messageData.orderID },
                                        { $set: { "returned": 'true' } }
                                    );
                                    console.log(info.value.returned);
                                    if (info.value.returned === 'false') {
                                        info.value.items.map(async item => {
                                            const info = { 'id': +item.id };
                                            await db.collection('warehousecollection').update(info, { $inc: { amount: +item.amount } }, (err, result) => {
                                                if (err) {
                                                    //   logger.error('не удалось вернуть товар на склад');

                                                } else {
                                                    //logger.info('товар успешно восстановлен на складе');
                                                    console.log(+item.amount);
                                                };
                                            })
                                        })
                                    }
                                }, transactionOptions);
                            } finally {
                                await session.endSession();
                            }

                        };

                    }
                }, {
                    noAck: true
                });
            });
        });
    });
};