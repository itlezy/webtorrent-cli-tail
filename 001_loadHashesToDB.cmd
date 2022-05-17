CD /D %~dp0

REM concatenate qBittorrent log files
type c:\tmp1\*.log* | find "- handleDHT" > z_in_log_hashes.txt

node loadHashesToDB.js
