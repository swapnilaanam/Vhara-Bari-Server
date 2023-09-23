const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000;
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);


// middleware
app.use(cors());
app.use(express.json());

// verify JWT
const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;

    if (!authorization) {
        return res.status(401).send({ error: true, message: 'Unauthorized Access...' });
    }

    const token = authorization.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ error: true, message: 'Unauthorized Access...' });
        }

        req.decoded = decoded;

        next();
    });
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.fuichu5.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();
        // Send a ping to confirm a successful connection

        const userCollection = client.db('vharaBari').collection('users');
        const houseCollection = client.db('vharaBari').collection('houses');
        const testimonialCollection = client.db('vharaBari').collection('testimonials');
        const paymentCollection = client.db('vharaBari').collection('payments');
        const rentedHouseCollection = client.db('vharaBari').collection('rentedhouses');
        const agentsCollection = client.db("vharaBari").collection("agents");


        // middleware
        // verify Tenant
        const verifyTenant = async (req, res, next) => {
            const email = req.decoded.email;

            const query = { email: email };

            const user = await userCollection.findOne(query);

            if (!user || user?.role !== 'Tenant') {
                return res.status(401).send({ error: true, message: 'Forbidden access' });
            }

            next();
        }

        // verify Owner
        const verifyOwner = async (req, res, next) => {
            const email = req.decoded.email;

            const query = { email: email };

            const user = await userCollection.findOne(query);

            if (!user || user?.role !== 'Owner') {
                return res.status(403).send({ error: true, message: 'Forbidden access...' });
            }

            next();
        }

        // verify Admin
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;

            const query = { email: email };

            const user = await userCollection.findOne(query);

            if (!user || user?.role !== 'Admin') {
                return res.status(403).send({ error: true, message: 'Forbidden Access...' });
            }

            next();
        }




        // jwt route
        app.post('/jwt', (req, res) => {
            const user = req.body;

            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
            res.send({ token });
        });





        // users route
        app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
            const query = {};

            const result = await userCollection.find(query).toArray();
            res.send(result);
        });


        app.get('/users/verify/:email', async (req, res) => {
            const { email } = req.params;

            const query = { email: email };

            const user = await userCollection.findOne(query);
            const result = { role: user?.role }
            res.send(result);
        });


        app.get(`/users/owner/:email`, verifyJWT, async (req, res) => {
            const { email } = req.params;

            if (req.decoded?.email !== email) {
                return res.send({ owner: false });
            }

            const query = { email: email };
            const user = await userCollection.findOne(query);
            const result = { owner: user?.role === 'Owner' };
            res.send(result);
        });


        app.get(`/users/tenant/:email`, verifyJWT, async (req, res) => {
            const { email } = req.params;

            if (req.decoded?.email !== email) {
                return res.send({ tenant: false });
            }

            const query = { email: email };
            const user = await userCollection.findOne(query);
            const result = { tenant: user?.role === 'Tenant' };
            res.send(result);
        });


        app.get(`/users/admin/:email`, verifyJWT, async (req, res) => {
            const { email } = req.params;

            if (req.decoded?.email !== email) {
                return res.send({ admin: false });
            }

            const query = { email: email };
            const user = await userCollection.findOne(query);
            const result = { admin: user?.role === 'Admin' };
            res.send(result);
        });

        app.post('/users', async (req, res) => {
            const newUser = req.body;

            const query = { email: newUser.email };

            const existingUser = await userCollection.findOne(query);

            if (existingUser) {
                return res.send({ message: 'Users Already Exists...' });
            }

            const result = await userCollection.insertOne(newUser);
            res.send(result);
        });


        app.patch('/users/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const { id } = req.params;

            const filter = { _id: new ObjectId(id) };

            const updateDoc = {
                $set: {
                    role: 'Admin'
                }
            };

            const result = await userCollection.updateOne(filter, updateDoc);
            res.send(result);
        });





        // houses route
        app.get('/houses', async (req, res) => {
            const { city } = req.query;

            // console.log(city);

            if (city) {
                const query = { city: city };

                const result = await houseCollection.find(query).toArray();
                res.send(result);
            }
            else {
                const query = {};
                const result = await houseCollection.find(query).toArray();
                res.send(result);
            }
        });


        app.get('/houses/user', verifyJWT, verifyOwner, async (req, res) => {
            const { email } = req.query;

            if (!email) {
                return res.send([]);
            }

            // console.log(email);

            const query = { ownerEmail: email };

            const result = await houseCollection.find(query).toArray();
            res.send(result);
        });


        app.get('/houses/:id', async (req, res) => {
            const { id } = req.params;

            const query = { _id: new ObjectId(id) };

            const result = await houseCollection.findOne(query);
            res.send(result);
        });


        app.post('/houses', verifyJWT, verifyOwner, async (req, res) => {
            const newHouse = req.body;

            const result = await houseCollection.insertOne(newHouse);
            res.send(result);
        });


        app.patch('/houses/:id', verifyJWT, verifyOwner, async (req, res) => {
            const { id } = req.params;
            const updatedHouse = req.body;

            const filter = { _id: new ObjectId(id) };

            const updateDoc = {
                $set: {
                    houseName: updatedHouse.houseName,
                    bedroomNumber: updatedHouse.bedroomNumber,
                    livingroomNumber: updatedHouse.livingroomNumber,
                    dineNumber: updatedHouse.dineNumber,
                    kitchenNumber: updatedHouse.kitchenNumber,
                    bathroomNumber: updatedHouse.bathroomNumber,
                    floorNumber: updatedHouse.floorNumber,
                    rentPrice: updatedHouse.rentPrice
                }
            };

            const result = await houseCollection.updateOne(filter, updateDoc);
            res.send(result);
        });


        app.patch('/houses/status/:id', verifyJWT, async (req, res) => {
            const { id } = req.params;
            const { status } = req.body;

            const filter = { _id: new ObjectId(id) };

            const updateDoc = {
                $set: {
                    status: status
                }
            };

            const result = await houseCollection.updateOne(filter, updateDoc);
            res.send(result);
        });


        app.delete('/houses/:id', verifyJWT, verifyOwner, async (req, res) => {
            const { id } = req.params;

            const query = { _id: new ObjectId(id) };

            const result = await houseCollection.deleteOne(query);
            res.send(result);
        });





        // testimonials route
        app.get('/testimonials', async (req, res) => {
            const query = {};

            const result = await testimonialCollection.find(query).toArray();
            res.send(result);
        });


        app.post('/testimonials', async (req, res) => {
            const newTestimonial = req.body;

            const result = await testimonialCollection.insertOne(newTestimonial);
            res.send(result);
        });


        //agents route
        app.get('/agents', async (req, res) => {
            const result = await agentsCollection.find({}).toArray();
            res.send(result);
        })


        // Payment Intent Route
        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            const { price } = req.body;

            const paymentIntent = await stripe.paymentIntents.create({
                amount: price * 100,
                currency: "bdt",
                payment_method_types: [
                    "card"
                ],
            });

            res.send({
                clientSecret: paymentIntent.client_secret
            });
        });


        // payments route
        app.get('/payments/owner/:email', verifyJWT, verifyOwner, async (req, res) => {
            const { email } = req.params;

            const query = {
                ownerEmail: email
            };

            const result = await paymentCollection.find(query).toArray();
            res.send(result);
        });

        app.get('/payments/:email', verifyJWT, verifyTenant, async (req, res) => {
            const { email } = req.params;

            const query = {
                email: email
            };

            const result = await paymentCollection.find(query).toArray();
            res.send(result);
        });

        app.post('/payments', verifyJWT, async (req, res) => {
            const payment = req.body;

            const result = await paymentCollection.insertOne(payment);
            res.send(result);
        });


        // rentedhouses route
        app.get('/rentedhouses', verifyJWT, async (req, res) => {
            const result = await rentedHouseCollection.find({}).toArray();
            res.send(result);
        })

        app.get('/rentedhouses/:email', verifyJWT, async (req, res) => {
            const { email } = req.params;

            const query = {
                renterEmail: email
            };

            const result = await rentedHouseCollection.find(query).toArray();
            res.send(result);
        })


        app.post('/rentedhouses', verifyJWT, async (req, res) => {
            const rentedHouse = req.body;

            const result = await rentedHouseCollection.insertOne(rentedHouse);
            res.send(result);
        });


        app.delete('/rentedhouses/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const {id}  = req.params;


            const filter = {_id: new ObjectId(id)};

            const result = await rentedHouseCollection.deleteOne(filter);
            res.send(result);
        })

        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Vhara Bari Is Running On Rent...');
});

app.listen(port, () => {
    console.log(`Vhara Bari Is Running On ${port}...`);
});