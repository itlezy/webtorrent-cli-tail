import fs from "fs";
import mongodb from "mongodb";

const MongoClient = mongodb.MongoClient;

// -----------------

const logLines = fs.readFileSync('z_in_log_hashes.txt', 'utf-8');

const dbName = "tor";
const dbCollectionName = "torrsv1";
const dbUri = `mongodb://127.0.0.1:27017/${dbName}`;
const dbClient = new MongoClient(dbUri);

// -----------------

let jsHashes = []

var i = 0

logLines.split(/\r?\n/).forEach(line => {
  if (i++ > 10000) { return }
  if (line.indexOf(" handleDHT") > 0) {
    let sha1 = line.substring(50, line.length - 1)
    fs.appendFileSync("/tmp/hashes.txt", sha1 + "\n")
    //jsHashes.push({ _id: sha1, processed: false })
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
