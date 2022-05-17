const MongoClient = require("mongodb").MongoClient;

// -----------------

const dbName = "tor";
const dbCollectionName = "torrsv1";
const dbUri = `mongodb://127.0.0.1:27017/${dbName}`;
const dbClient = new MongoClient(dbUri);

// -----------------

async function run() {
  try {
    await dbClient.connect();
    const database = dbClient.db(`${dbName}`);
    const dbHashes = database.collection(`${dbCollectionName}`);

    const filter = { timeout: true }
    const updateDoc = {
      $set: { processed: false },
      $currentDate: { lastModified: true }
    }

    const result = await dbHashes.updateMany(
      filter,
      updateDoc
    )

    console.log(`Updated ${result.modifiedCount} documents`)
  } finally {
    await dbClient.close();
  }
}

run().catch(console.dir);
