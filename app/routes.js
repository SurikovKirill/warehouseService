var ObjectID = require('mongodb').ObjectID;


module.exports = function (app, db, client) {

    async function autoIncrement() {
        const info = { '_id': new ObjectID('5df4b01dc4024e05342a7559') };
        console.log(info);
        const nextID = await db.collection('count').findOneAndUpdate(info, { $inc: { count: 1 } });
        console.log(nextID);
        return nextID.value.count;
    };

    app.put('/warehouse/items/:id/addition/:amount', async (req, res) => {
        const id = +req.params.id;
        console.log(id);
        const amount = +req.params.amount;
        if (!req.params.amount || !Number.isInteger(+req.params.amount)) {
            logger.error('данные количества введены не верно');
            res.status(400).send('amount is not numeric or not integer');
        } else {
            const session = client.startSession();
            const transactionOptions = {
                readPreference: 'primary',
                readConcern: { level: 'local' },
                writeConcern: { w: 'majority' }
            };
            try {
                await session.withTransaction(async () => {

                    await db.collection('warehousecollection').update({id: id}, { $inc: { amount: +amount } }, (err, item) => {
                        if (err) {
                            res.send({ 'error': 'an error has occured' });
                            logger.error('не удалось изменить данные о товаре');
                        } else {
                            db.collection('warehousecollection').findOne({id: id}, (err, item) => {
                                if (err) {
                                    res.send({ 'error': 'an error has occured' });
                                } else {
                                    if (item) {
                                        res.send(item);
                                        logger.info('количество товаров успешно изменено');
                                    } else {
                                        res.status(502).send('item not exhists');
                                        logger.error('данные о товаре отсутствуют');
                                    };
                                }
                            });
                        }
                    });

                }, transactionOptions);
            } finally {
                await session.endSession();
            }
        }
    });



    app.post('/warehouse/items', async (req, res) => {
        if (!Number.isInteger(+req.body.amount) || !+req.body.amount || !+req.body.price || !req.body.name) {
            res.status(400).send('amount or price is not numeric or amount is not integer');
            logger.error('данные цены или количества введены не верно');
        } else {
            const customID = await autoIncrement();
         
            const note = { id: customID, name: req.body.name, amount: +req.body.amount, price: +req.body.price };
            db.collection('warehousecollection').insert(note, (err, result) => {
                if (err) {
                    res.send({ 'error': 'an error has occured' });
                    logger.error('не удалось добавить данные в бд');
                } else {
                    res.send(result.ops[0]);
                    logger.info('данные успешно добавлены в базу');
                }
            });
        }
    });

    app.get('/warehouse/items/:id', (req, res) => {
        const id = +req.params.id;
        //const info = { '_id': new ObjectID(id) };
console.log(id);
        db.collection('warehousecollection').findOne({id: id}, (err, item) => {
            if (err) {
                res.send({ 'error': 'an error has occured' });
                logger.error('не удалось получить данные по id');
            } else {
                if (item) {
                    res.send(item);
                    logger.info('данные по id получены успешно');
                } else {
                    res.status(502).send('item not exhists');
                    logger.error('данные о товаре отсутствуют');
                }

            }
        });
    });

    app.get('/warehouse/items', (req, res) => {
        db.collection('warehousecollection').find({}).toArray((err, result) => {
            if (err) {
                res.send({ 'error': 'an error has occured' });
                logger.error('не удалось получить данные о товарах');
            } else {
                res.send(result);
                logger.info('данные о всех товарах на складе получены успешно');
            }
        });
    });



};