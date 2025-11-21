// server.js
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();

// ----- MIDDLEWARE -----
app.use(cors());
app.use(express.json());

// simple logger
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
    next();
});

// serve static images from /images folder
const imagesPath = path.join(__dirname, 'Images');
app.use('/images', express.static(imagesPath));

// ----- DB SETUP -----
const uri = process.env.MONGODB_URI;
const dbName = process.env.DB_NAME;

let lessonsCollection;
let ordersCollection;

// Connect to MongoDB, then set up routes and start server
MongoClient.connect(uri)
    .then(client => {
        console.log('Connected to MongoDB');

        const db = client.db(dbName);
        lessonsCollection = db.collection('lesson');
        ordersCollection = db.collection('order');

        // ----- ROUTES -----

        // Test route
        app.get('/', (req, res) => {
            res.send('Backend + MongoDB are working ✅');
        });

        // GET /lessons - return all lessons from MongoDB
        app.get('/lessons', async (req, res) => {
            try {
                const lessons = await lessonsCollection.find({}).toArray();

                // convert _id to string and normalise field names for frontend
                const formatted = lessons.map(l => ({
                    _id: l._id.toString(),
                    subject: l.topic,
                    location: l.location,
                    price: l.price,
                    spaces: l.spaces ?? l.space,
                    rating: l.rating ?? 0,
                    image: l.image
                }));

                res.json(formatted);
            } catch (err) {
                console.error('Error fetching lessons:', err);
                res.status(500).json({ error: 'Failed to fetch lessons' });
            }
        });

        // GET /lessons/:id - return single lesson
        app.get('/lessons/:id', async (req, res) => {
            try {
                const id = req.params.id;

                if (!ObjectId.isValid(id)) {
                    return res.status(400).json({ error: 'Invalid lesson id' });
                }

                const lesson = await lessonsCollection.findOne({ _id: new ObjectId(id) });

                if (!lesson) {
                    return res.status(404).json({ error: 'Lesson not found' });
                }

                const formatted = {
                    _id: lesson._id.toString(),
                    subject: lesson.subject ?? lesson.topic,
                    location: lesson.location,
                    price: lesson.price,
                    spaces: lesson.spaces ?? lesson.space,
                    rating: lesson.rating ?? 0,
                    image: lesson.image
                };

                res.json(formatted);
            } catch (err) {
                console.error('Error fetching lesson by id:', err);
                res.status(500).json({ error: 'Failed to fetch lesson' });
            }
        });


        // PUT /lessons/:id - update a lesson (e.g. spaces)
        app.put('/lessons/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const updates = req.body; // e.g. { spaces: 3 }

                if (!updates || typeof updates !== 'object') {
                    return res.status(400).json({ error: 'No updates provided' });
                }

                // id must be a valid ObjectId string (24 hex chars)
                if (!ObjectId.isValid(id)) {
                    return res.status(400).json({ error: 'Invalid lesson id' });
                }

                const result = await lessonsCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: updates }
                );

                if (result.matchedCount === 0) {
                    return res.status(404).json({ error: 'Lesson not found' });
                }

                res.json({ message: 'Lesson updated' });
            } catch (err) {
                console.error('Error updating lesson:', err);
                res.status(500).json({ error: 'Failed to update lesson' });
            }
        });


        // POST /orders - create a new order
        app.post('/orders', async (req, res) => {
            try {
                const order = req.body;

                // allow phoneNumber OR phone
                order.phone = order.phone || order.phoneNumber;

                if (!order.name || !order.phone || !Array.isArray(order.lessonIDs)) {
                    return res.status(400).json({ error: 'Invalid order data' });
                }

                const result = await ordersCollection.insertOne(order);

                res.status(201).json({
                    message: 'Order created',
                    orderId: result.insertedId,
                });
            } catch (err) {
                console.error('Error creating order:', err);
                res.status(500).json({ error: 'Failed to create order' });
            }
        });

        // 404 handler – must be AFTER all routes
        app.use((req, res) => {
            res.status(404).json({ error: 'Resource not found' });
        });

        // Global error handler
        app.use((err, req, res, next) => {
            console.error('Unhandled error:', err);
            res.status(500).json({ error: 'Something went wrong on the server' });
        });


        // ----- START SERVER -----
        const port = process.env.PORT || 3000;
        app.listen(port, () => {
            console.log(`Server running on port ${port}`);
        });
    })
    .catch(err => {
        console.error('Failed to connect to MongoDB:', err);
    });


