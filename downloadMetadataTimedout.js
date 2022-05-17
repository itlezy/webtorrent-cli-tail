import chalk from "chalk";
import fs, { stat } from "fs";
import WebTorrent from "webtorrent";
import mongodb from "mongodb";
import natUpnp from "nat-upnp";
//import MemoryChunkStore from "memory-chunk-store";
import FSChunkStore from "fs-chunk-store";


const MongoClient = mongodb.MongoClient;

// -----------------

const dbName = "tor";
const dbCollectionName = "torrsv1";
const dbUri = `mongodb://127.0.0.1:27017/${dbName}`;

// -----------------

const MAIN_LOOP_INTERVAL = 1333
const MONGO_GRACE_DELAY = 99
const TORRENT_METADATA_TIMEOUT = 366666
const TORRENT_OUTPUT_PATH = "/tmp_out"
const TORRENT_PARALLEL_LIMIT = 166

// -----------------

const torClient = new WebTorrent()
let listenPort = 0
let gracefullyExiting = false

function gracefulExit() {
    if (gracefullyExiting) {
        return
    }

    gracefullyExiting = true

    console.log(`webtorrent is exiting, unmapping port ${listenPort}...`)

    natUpnp.createClient().portUnmapping(
        {
            public: listenPort,
            protocol: "udp"
        }
    )

    process.removeListener('SIGINT', gracefulExit)
    process.removeListener('SIGTERM', gracefulExit)

    setTimeout(() => process.exit(0), 3000)
}

process.on('SIGINT', gracefulExit)
process.on('SIGTERM', gracefulExit)

const stats = {
    processed: 0,
    downloaded: 0,
    timeout: 0,
    lastDownloaded: new Date()
}

torClient.dht.on("ready", function () {
    console.log("WebTorrent()       - DHT Ready, starting main loop..")

    mainLoop()
})

torClient.dht.on("listening", function () {
    console.log("WebTorrent()       - DHT Listening", torClient.dht.address())

    listenPort = torClient.dht.address().port

    natUpnp.createClient().portMapping({
        public: listenPort,
        private: listenPort,
        protocol: "udp",
        ttl: 0
    }, function (err) {
        if (err) console.log("WebTorrent()       - UPNP NAT Port mapping failed", err)
    })

})

async function getNextHashId() {
    const dbClient = new MongoClient(dbUri)

    try {

        await dbClient.connect()
        const database = dbClient.db(`${dbName}`)
        const dbHashes = database.collection(`${dbCollectionName}`)

        const query = { $and: [{ processed: true }, { timeout: true }] }
        const options = {
            projection: { _id: 1, processed: 1 },
        };
        const dbHash = await dbHashes.findOne(query, options)

        // console.log(`getNextHashId()    - Returning      ${chalk.green(dbHash._id)}`)

        stats.processed++
        return dbHash._id
    } finally {
        await dbClient.close()
        await new Promise(r => setTimeout(r, MONGO_GRACE_DELAY))
    }
}

async function updateNextHashId(hashId) {
    // console.log(`updateNextHashId() - Updating   ${chalk.green(dbHash._id)}`)

    const dbClient = new MongoClient(dbUri)

    try {

        await dbClient.connect()
        const database = dbClient.db(`${dbName}`)
        const dbHashes = database.collection(`${dbCollectionName}`)

        const filter = { _id: hashId }

        const updateDoc = {
            $set: {
                processed: true,
                timeout: false,
                processedTime: new Date()
            },
        }

        const result = await dbHashes.updateOne(filter, updateDoc)

        // console.log(`updateNextHashId() - Torrent ${hashId} record updated on DB ${result.modifiedCount}`)

        return hashId
    } finally {
        await dbClient.close()
        await new Promise(r => setTimeout(r, MONGO_GRACE_DELAY))
    }
}

async function updateHash(hashId, torrent, timeout) {
    const dbClient = new MongoClient(dbUri)

    try {
        await dbClient.connect()
        const database = dbClient.db(`${dbName}`)
        const dbHashes = database.collection(`${dbCollectionName}`)

        const filter = { _id: hashId }

        const updateDoc = {
            $set: {
                processed: true,
                processedTime: new Date(),
                downloaded: timeout ? false : true,
                downloadedTime: new Date(),
                name: torrent.name,
                length: torrent.length,
                comment: torrent.comment,
                timeout: timeout
            },
        }

        const result = await dbHashes.updateOne(filter, updateDoc)

        //if (timeout) console.log(`updateHash()       - Torrent ${chalk.red(hashId)} record updated on db ${result.modifiedCount}, timeout    ${chalk.red(timeout)}`)
        //else console.log(`updateHash()       - Torrent ${chalk.magentaBright(hashId)} record updated on db ${result.modifiedCount}, downloaded ${chalk.magentaBright(!timeout)}`)

        if (timeout) { stats.timeout++ }
        else { stats.downloaded++; stats.lastDownloaded = new Date() }

    } finally {
        await dbClient.close()
        await new Promise(r => setTimeout(r, MONGO_GRACE_DELAY))
    }
}

function runDownloadMeta(hashId) {
    console.log(`runDownloadMeta()  - Adding torrent ${chalk.green(hashId)}, torrents count ${chalk.white(torClient.torrents.length)}, DHT nodes ${chalk.white(torClient.dht.nodes.count())}`)

    if (torClient.get(hashId)) {
        console.error(`runDownloadMeta()  - Torrent ${hashId} already addedd to Torrent client?`)
        return
    }

    let removeOnTimeout = setTimeout(function () {
        console.log(`runDownloadMeta()  - Removing torrent due to timeout ${chalk.red(hashId)}`)

        if (torClient.get(hashId)) {
            torClient.remove(hashId)
            updateHash(hashId, torrent, true)
        } else {
            console.error(`runDownloadMeta()  - Torrent ${hashId} already removed from Torrent client? (removeOnTimeout)`)
        }

    }, TORRENT_METADATA_TIMEOUT)

    const torrent = torClient.add(hashId, {
        store: FSChunkStore, //MemoryChunkStore,
        destroyStoreOnDestroy: true
    })

    torrent.on("infoHash", function () {
        updateMetadata()

        torrent.on("wire", updateMetadata)

        function updateMetadata() {
            // console.log(`runDownloadMeta()  - Fetching torrent ${hashId} metadata from ${torrent.numPeers} ..`)
        }

        torrent.on("metadata", async function () {
            clearTimeout(removeOnTimeout)
            torrent.removeListener("wire", updateMetadata)

            console.log(`runDownloadMeta()  - Metadata received, saving torrent to - ** [ ${chalk.magentaBright(this.name + ".torrent")} ] ** -`)
            fs.writeFileSync(`${TORRENT_OUTPUT_PATH}/${this.name}.torrent`, this.torrentFile)

            if (torClient.get(hashId)) {
                torClient.remove(hashId)
            } else {
                console.error(`runDownloadMeta()  - Torrent ${hashId} already removed from Torrent client? (download OK)`)
            }

            updateHash(hashId, torrent, false)
        })
    })
}

// main loop to check how many torrents in torClient

let printCounter = 0
async function mainLoop() {
    if (gracefullyExiting) return

    if (printCounter++ % 10 == 0)
        console.log(`mainLoop()         - Main loop check, active torrents count ${chalk.white(torClient.torrents.length)}, timeout ${stats.timeout}, downloaded ${stats.downloaded}, last downloaded ${stats.lastDownloaded.toISOString()}`)

    if (torClient.torrents.length < TORRENT_PARALLEL_LIMIT) {
        const _hashId = await getNextHashId()
        await updateNextHashId(_hashId)
        runDownloadMeta(_hashId)
    }

    setTimeout(async function () { await mainLoop() }, MAIN_LOOP_INTERVAL)
}
