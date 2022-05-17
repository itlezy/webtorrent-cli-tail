const MongoClient = require("mongodb").MongoClient;

// -----------------


const dbName = "tor";
const dbCollectionName = "torrsv1";
const dbUri = `mongodb://127.0.0.1:27017/`;
const dbClient = new MongoClient(dbUri);

// -----------------


MongoClient.connect(dbUri, function (err, db) {
  if (err) throw err;
  var dbo = db.db(dbName);

  dbo.dropCollection(dbCollectionName, function (err, delOK) {
    if (err) throw err;
    if (delOK) console.log("Collection deleted");
    db.close();
  });
});
