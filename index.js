const express = require("express");
const cors = require("cors");
const ImageKit = require("@imagekit/nodejs");
const admin = require('firebase-admin');
const app = express();
require("dotenv").config()

// Initialize Firebase Admin robustly from env vars.
// Support `FASDK` (base64 or raw JSON) or individual FIREBASE_* vars.
let initialized = false;
const fasdk = process.env.FASDK;
if (fasdk) {
  try {
    let parsed;
    try {
      const decoded = Buffer.from(fasdk, 'base64').toString('utf8');
      parsed = JSON.parse(decoded);
    } catch (e) {
      parsed = JSON.parse(fasdk);
    }
    const projectId = parsed.project_id || parsed.projectId;
    const clientEmail = parsed.client_email || parsed.clientEmail;
    const privateKeyRaw = parsed.private_key || parsed.privateKey;
    if (projectId && clientEmail && privateKeyRaw) {
      const privateKey = privateKeyRaw.replace(/\\n/g, '\n');
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
      console.log('Firebase Admin initialized from FASDK env var');
      initialized = true;
    }
  } catch (err) {
    console.warn('Failed to parse FASDK env var:', err && err.message);
  }
}

if (!initialized) {
  const firebasePrivateKey = process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    : undefined;

  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && firebasePrivateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: firebasePrivateKey,
      }),
    });
    console.log('Firebase Admin initialized from FIREBASE_* environment variables');
    initialized = true;
  }
}

if (!initialized) {
  console.warn('Firebase Admin not initialized: missing credentials (FASDK or FIREBASE_*)');
}

const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion } = require('mongodb');

app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'https://sbssbu.web.app',
    '' // ✅ add this line
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
}));
app.use(express.json());


// imgkit client
const imgkitClient = new ImageKit({
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  urlEndpoint: process.env.PUBLICURL,
});

// allow cross-origin requests
app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});

app.get("/auth", function (req, res) {
  // Your application logic to authenticate the user
  // For example, you can check if the user is logged in or has the necessary permissions
  // If the user is not authenticated, you can return an error response
  const { token, expire, signature } =
    imgkitClient.helper.getAuthenticationParameters();
  res.send({
    token,
    expire,
    signature,
    publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  });
});



//middleware

const verifyFBToken = async(req, res, next)=>{
   const token =  req.headers.authorization
   if(!token){
    return res.status(401).send({message:"unauthorize access"})
   }
   try{
    const idToken = token.split(' ')[1]
    const decoded = await admin.auth().verifyIdToken(idToken)
    console.log(decoded)
    req.decoded_email = decoded.email
   }catch(err){
    return res.status(401).send({message: "unauthorized access"})
   }
 
next()
}



const uri = process.env.URI
let userCollection;

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
    const db = client.db("sbssbuDb");
    userCollection = db.collection("users");
    registrationsCollection = db.collection("registrations");
    // const parcelCollection = db.collection("parcels");
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get("/", (req, res)=>{
    res.send("The server is running")
    
})

// user realted middleware

app.post("/users", async (req, res) => {
  const user = req.body;
  user.role = 'user';
  user.createdAt = new Date()

  if (!userCollection) {
    return res.status(503).send({ message: "User collection is not ready yet" });
  }

  const existingUser = await userCollection.findOne({ email: user.email });
  if (existingUser) {
    return res.send({ message: "User already exists" });
  }

  const result = await userCollection.insertOne(user);
  res.send(result);
});

// Registration endpoint - requires verified Firebase token


// Programme Registration endpoint - accepts form submissions
app.post("/registration", async (req, res) => {
  try {
    
    

    // Create registration record
    const registration = {
      name_bn,
      sabek_bortoman,
      songotonik_man,
      daitto,
      imageUrl: imageUrl || "",
      organizational_branch,
      tshirt_size,
      sendmoney_number,
      transaction_Id,
      phone_number,
      whatsapp_number,
      present_area,
      present_thana,
      present_zilla,
      permanent_union,
      permanent_ward,
      registration_status: "pending",
      registered_at: new Date(),
      ip_address: req.ip || req.connection.remoteAddress
    };

    const result = await registrationsCollection.insertOne(registration);

    res.send({
      success: true,
      message: "Registration successful",
      insertedId: result.insertedId
    });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).send({ message: "Registration failed", error: err.message });
  }
});

app.listen(port, ()=>{
    console.log(`Server is running on port ${port}`)
})