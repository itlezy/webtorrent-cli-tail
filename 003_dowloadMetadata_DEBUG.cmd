CD /D %~dp0

:BEGIN

CLS

node --inspect downloadMetadata.js

IF %ERRORLEVEL% NEQ 0 (
  PAUSE
  GOTO :BEGIN
)
