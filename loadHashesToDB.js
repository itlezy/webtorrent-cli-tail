const fs = require("fs");
const MongoClient = require("mongodb").MongoClient;

// -----------------

const logLines = fs.readFileSync('z_in_log_hashes.txt', 'utf-8');

const dbName = "tor";
const dbCollectionName = "torrsv1";
const dbUri = `mongodb://127.0.0.1:27017/${dbName}`;
const dbClient = new MongoClient(dbUri);

// -----------------

let jsHashes = []

logLines.split(/\r?\n/).forEach(line => {
  if (line.indexOf(" handleDHT") > 0) {
    let sha1 = line.substring(50, line.length - 1)
    //console.log("Sha1", sha1)
    jsHashes.push({ _id: sha1, processed: false })
  }
});

async function run() {
  try {
    await dbClient.connect();
    const database = dbClient.db(`${dbName}`);
    const dbHashes = database.collection(`${dbCollectionName}`);

    // this option prevents additional documents from being inserted if one fails
    const options = { ordered: false };

    const result = await dbHashes.insertMany(jsHashes, options);
    console.log(`${result.insertedCount} documents were inserted`);
  } finally {
    await dbClient.close();
  }
}

run().catch(console.dir);
