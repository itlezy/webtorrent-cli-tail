# webtorrent-cli-tail
A tool to download Torrent metadata from info-hashes that have been captured by listening to the DHT.

The process is quite simple, you can listen to the DHT in a number of ways, in example by applying a small patch to qBittorrent or using Dodder (or my clone https://github.com/itlezy/LezyDodder ).

Once you have obtained a list of hashes, you can load them in a MongoDB for ease of processing. The tool here would read hashes from MongoDB and attempt to download their metadata directly from the DHT and saving to a file.


## qBittorrent patch

A feature to listen to the DHT `get_peers` and `announce_peer` to potentially find new torrents hashes, download their metadata and show them in the qBittorrent interface.

As we are already active nodes in the DHT you can activate the DHT alerts

```c
void Session::initializeNativeSession()
{
    const lt::alert_category_t alertMask = lt::alert::error_notification
        | lt::alert::dht_notification
```

and capture hashes that are queried around the DHT

```c
void Session::handleDHTAnnounceAlert(const lt::dht_announce_alert* p)
{
    const lt::sha1_hash infoHash = p->info_hash;
    const QByteArray raw = QByteArray::fromRawData(infoHash.data(), infoHash.size());
    LogMsg(tr("handleDHTAnnounceAlert \"%1\"").arg(QString::fromLatin1(raw.toHex())), Log::INFO);
}

void Session::handleDHTGetPeersAlert(const lt::dht_get_peers_alert* p)
{
    const lt::sha1_hash infoHash = p->info_hash;
    const QByteArray raw = QByteArray::fromRawData(infoHash.data(), infoHash.size());
    LogMsg(tr("handleDHTGetPeersAlert \"%1\"").arg(QString::fromLatin1(raw.toHex())), Log::INFO);
}
```

