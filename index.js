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
      // console.log('Firebase Admin initialized from FASDK env var');
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
    
    initialized = true;
  }
}

if (!initialized) {
  // console.warn('Firebase Admin not initialized: missing credentials (FASDK or FIREBASE_*)');
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
    // console.log(decoded)
    req.decoded_email = decoded.email
   }catch(err){
    return res.status(401).send({message: "unauthorized access"})
   }
 
next()
}



const uri = process.env.URI
// console.log(process.env.URI)
let userCollection;
let registrationsCollection;

// Validate MongoDB URI exists
if (!uri) {
  console.error("❌ FATAL: MongoDB URI is not set!");
  console.error("Please create a .env file with: URI=your_mongodb_connection_string");
  console.error("See .env.example for the required format");
}

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri || "mongodb://localhost:27017", {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    console.log("🔄 Attempting to connect to MongoDB...");
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const db = client.db("sbssbuDb");
    userCollection = db.collection("users");
    registrationsCollection = db.collection("registrations");
    // const parcelCollection = db.collection("parcels");
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("✅ Successfully connected to MongoDB!");
    
    // Start the server AFTER database connection is successful
    app.listen(port, ()=>{
      console.log(`Server is running on port ${port}`)
    })
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
    console.error("Please check your MongoDB URI in .env file");
    process.exit(1);
  }
}
run().catch((err) => {
  console.error("❌ Critical error during MongoDB connection:", err);
  process.exit(1);
});

// Programme Registration endpoint - accepts form submissions
app.post("/registration", async (req, res) => {
  try {
    console.log("Registration request received:", req.body);
    
    const {
      name_bn,
      sabek_bortoman,
      songotonik_man,
      daitto,
      imageUrl,
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
    } = req.body;

    // Validate required fields
    if (!name_bn || !phone_number || !transaction_Id) {
      console.warn("Missing required fields");
      return res.status(400).send({
        success: false,
        message: "Missing required fields: name_bn, phone_number, transaction_Id",
      });
    }

    // Check if database collection is ready
    if (!registrationsCollection) {
      console.error("Registrations collection is not initialized");
      return res.status(503).send({
        success: false,
        message: "Database not initialized. Please try again later.",
      });
    }

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

    console.log("Attempting to insert registration...");
    const result = await registrationsCollection.insertOne(registration);
    
    console.log("Registration successful, insertedId:", result.insertedId);

    res.send({
      success: true,
      message: "Registration successful",
      insertedId: result.insertedId
    });
  } catch (err) {
    console.error("Registration error details:", err);
    res.status(500).send({ 
      success: false,
      message: "Registration failed: " + err.message, 
      error: err.message 
    });
  }
});


app.get("/", (req, res)=>{
    res.send("The server is running")
    
})

// Admin verification middleware
const verifyAdmin = async (req, res, next) => {
  const email = req.params.email;
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).send({ message: "Unauthorized access" });
  }

  try {
    const idToken = token.split(' ')[1];
    const decoded = await admin.auth().verifyIdToken(idToken);
    
    if (decoded.email !== email) {
      return res.status(403).send({ message: "Token email mismatch" });
    }

    const user = await userCollection.findOne({ email });
    if (!user || user.role !== 'admin') {
      return res.status(403).send({ message: "Admin access required" });
    }

    req.userEmail = email;
    next();
  } catch (err) {
    return res.status(401).send({ message: "Unauthorized access" });
  }
};

// user related middleware

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

// Check if user is admin
app.get("/users/admin/:email", verifyFBToken, async (req, res) => {
  try {
    const email = req.params.email;
    
    if (!userCollection) {
      return res.status(503).send({ message: "User collection is not ready yet" });
    }

    const user = await userCollection.findOne({ email });
    const isAdmin = user && user.role === 'admin';
    
    res.send({ admin: isAdmin });
  } catch (err) {
    res.status(500).send({ message: "Error checking admin status" });
  }
});

// ADMIN DASHBOARD ENDPOINTS

// Get dashboard statistics
app.get("/admin/statistics", verifyFBToken, async (req, res) => {
  try {
    const email = req.decoded_email;
    
    if (!userCollection || !registrationsCollection) {
      return res.status(503).send({ message: "Database not ready" });
    }

    const user = await userCollection.findOne({ email });
    if (!user || user.role !== 'admin') {
      return res.status(403).send({ message: "Admin access required" });
    }

    // Get all registrations for statistics
    const allRegistrations = await registrationsCollection.find({}).toArray();

    // Calculate sabek/bortoman counts
    const sabek = allRegistrations.filter(r => r.sabek_bortoman === 'sabek').length;
    const bortoman = allRegistrations.filter(r => r.sabek_bortoman === 'bortoman').length;

    // Calculate member/associate counts
    const member = allRegistrations.filter(r => r.songotonik_man === 'member').length;
    const associate = allRegistrations.filter(r => r.songotonik_man === 'associate').length;

    // Combined counts
    const sabek_member = allRegistrations.filter(r => r.sabek_bortoman === 'sabek' && r.songotonik_man === 'member').length;
    const sabek_associate = allRegistrations.filter(r => r.sabek_bortoman === 'sabek' && r.songotonik_man === 'associate').length;
    const bortoman_member = allRegistrations.filter(r => r.sabek_bortoman === 'bortoman' && r.songotonik_man === 'member').length;
    const bortoman_associate = allRegistrations.filter(r => r.sabek_bortoman === 'bortoman' && r.songotonik_man === 'associate').length;

    // Count by permanent_union
    const permanentUnionCounts = {};
    allRegistrations.forEach(r => {
      const union = r.permanent_union || 'unknown';
      permanentUnionCounts[union] = (permanentUnionCounts[union] || 0) + 1;
    });

    // Count by tshirt_size (only accepted registrations)
    const tshirtSizeCounts = {};
    allRegistrations
      .filter(r => r.registration_status === 'accepted')
      .forEach(r => {
        const size = r.tshirt_size || 'unknown';
        tshirtSizeCounts[size] = (tshirtSizeCounts[size] || 0) + 1;
      });

    // Status counts
    const pending = allRegistrations.filter(r => r.registration_status === 'pending').length;
    const accepted = allRegistrations.filter(r => r.registration_status === 'accepted').length;
    const rejected = allRegistrations.filter(r => r.registration_status === 'rejected').length;

    res.send({
      success: true,
      data: {
        sabek,
        bortoman,
        member,
        associate,
        combined: {
          sabek_member,
          sabek_associate,
          bortoman_member,
          bortoman_associate,
        },
        permanentUnionCounts,
        tshirtSizeCounts,
        statusCounts: {
          pending,
          accepted,
          rejected,
          total: allRegistrations.length,
        },
      },
    });
  } catch (err) {
    console.error("Statistics error:", err);
    res.status(500).send({ message: "Error fetching statistics", error: err.message });
  }
});

// Get registrations by status
app.get("/admin/registrations/:status", verifyFBToken, async (req, res) => {
  try {
    const email = req.decoded_email;
    const status = req.params.status.toLowerCase();

    if (!userCollection || !registrationsCollection) {
      return res.status(503).send({ message: "Database not ready" });
    }

    const user = await userCollection.findOne({ email });
    if (!user || user.role !== 'admin') {
      return res.status(403).send({ message: "Admin access required" });
    }

    // Get search parameters
    const { transaction_id, sendmoney_number } = req.query;
    const filter = { registration_status: status };

    if (transaction_id) {
      filter.transaction_Id = { $regex: transaction_id, $options: 'i' };
    }

    if (sendmoney_number) {
      filter.sendmoney_number = { $regex: sendmoney_number, $options: 'i' };
    }

    const registrations = await registrationsCollection
      .find(filter)
      .sort({ registered_at: -1 })
      .toArray();

    res.send({
      success: true,
      data: registrations,
      count: registrations.length,
    });
  } catch (err) {
    console.error("Error fetching registrations:", err);
    res.status(500).send({ message: "Error fetching registrations", error: err.message });
  }
});

// Update registration status
app.patch("/admin/registrations/:id/status", verifyFBToken, async (req, res) => {
  try {
    const email = req.decoded_email;
    const registrationId = req.params.id;
    const { status } = req.body;

    if (!userCollection || !registrationsCollection) {
      return res.status(503).send({ message: "Database not ready" });
    }

    const user = await userCollection.findOne({ email });
    if (!user || user.role !== 'admin') {
      return res.status(403).send({ message: "Admin access required" });
    }

    // Validate status
    const validStatuses = ['pending', 'accepted', 'rejected'];
    if (!validStatuses.includes(status.toLowerCase())) {
      return res.status(400).send({ message: "Invalid status value" });
    }

    const { ObjectId } = require('mongodb');
    const result = await registrationsCollection.updateOne(
      { _id: new ObjectId(registrationId) },
      { $set: { registration_status: status.toLowerCase(), updated_at: new Date() } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).send({ message: "Registration not found" });
    }

    res.send({
      success: true,
      message: "Status updated successfully",
    });
  } catch (err) {
    console.error("Error updating status:", err);
    res.status(500).send({ message: "Error updating status", error: err.message });
  }
});

// Delete registration
app.delete("/admin/registrations/:id", verifyFBToken, async (req, res) => {
  try {
    const email = req.decoded_email;
    const registrationId = req.params.id;

    if (!userCollection || !registrationsCollection) {
      return res.status(503).send({ message: "Database not ready" });
    }

    const user = await userCollection.findOne({ email });
    if (!user || user.role !== 'admin') {
      return res.status(403).send({ message: "Admin access required" });
    }

    const { ObjectId } = require('mongodb');
    const result = await registrationsCollection.deleteOne(
      { _id: new ObjectId(registrationId) }
    );

    if (result.deletedCount === 0) {
      return res.status(404).send({ message: "Registration not found" });
    }

    res.send({
      success: true,
      message: "Registration deleted successfully",
    });
  } catch (err) {
    console.error("Error deleting registration:", err);
    res.status(500).send({ message: "Error deleting registration", error: err.message });
  }
});

// Registration endpoint - requires verified Firebase token