const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: 'unauthorized access' });
  }
  // bearer token
  const token = authorization.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ error: true, message: 'unauthorized access' })
    }
    req.decoded = decoded;
    next();
  })
}


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster1.szjz2sd.mongodb.net/?retryWrites=true&w=majority`;

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
    const usersCollection = client.db("ZukoDB").collection("users");
    const galleriesCollection = client.db("ZukoDB").collection("galleries");

    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
      res.send({ token })
    })

    // Warning: use verifyJWT before using verifyAdmin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await usersCollection.findOne(query);
      if (user?.role !== 'admin') {
        return res.status(403).send({ error: true, message: 'forbidden message' });
      }
      next();
    }
    const verifyPhotographer = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await usersCollection.findOne(query);
      if (user?.role !== 'photographer') {
        return res.status(403).send({ error: true, message: 'forbidden message' });
      }
      next();
    }

    app.get('/all-galleries', async (req, res) => {
      const result = await galleriesCollection.find({ status: 'true' }).toArray();
      res.send(result);
    });

    app.get('/all-photographers', async (req, res) => {
      const photographers = await usersCollection.find({ role: 'photographer' }).toArray();
      res.send(photographers);
    });
    app.get('/users', async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });
    
    app.post('/users', async (req, res) => {
      const user = req.body;
      console.log(user.email);
      const query = { email: user.email }
      const existingUser = await usersCollection.findOne(query);

      if (existingUser) {
        return res.send({ message: 'user already exists' })
      }

      const result = await usersCollection.insertOne(user);
      res.send(result);
    });
      //for useAdmin
    app.get('/users/admin/:email',verifyJWT,  async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ admin: false })
      }

      const query = { email: email }
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === 'admin' }
      res.send(result);
    });
    //for usePhotographer
    app.get('/users/photographer/:email',verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ photographer: false })
      }

      const query = { email: email }
      const user = await usersCollection.findOne(query);
      const result = { photographer: user?.role === 'photographer' }
      res.send(result);
    });


   // my galleries for  photographer 
   app.get('/my-galleries',verifyJWT, async (req, res) => {
    try {
      const email = req.decoded.email;
      const galleries = await galleriesCollection.find({ photographerEmail: email }).toArray();
      res.json(galleries);
    } catch (error) {
      console.error('Error fetching galleries:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  // for add new image
  app.post('/galleries',  async (req, res) => {
    const galleries = req.body;
    const result = await galleriesCollection.insertOne(galleries)
    res.send(result);
  });

    //update photo from photographer
    app.put("/galleries/update/:id", async (req, res) => {
      const id = req.params.id;
      const body = req.body;
      const options = { upsert: true };
      const filter = { _id: new ObjectId(id) };
      const updateData = {
        $set: {
          price: body.price,
          details: body.details,
        },
      };
      const result = await galleriesCollection.updateOne(filter, updateData, options);
      res.send(result);
    });

     //for make photographer
     app.patch('/users/photographer/:id', async (req, res) => {
      const id = req.params.id;
      // console.log(id);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "photographer"
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);

    });
    //for make admin
    app.patch('/users/admin/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "admin"
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);

    });


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('ziko is sitting')
})

app.listen(port, () => {
  console.log(`ziko is sitting on port ${port}`);
})
