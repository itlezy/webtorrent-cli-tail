CD /D %~dp0

:BEGIN

CLS

node downloadMetadataTimedout.js

IF %ERRORLEVEL% NEQ 0 (
  PAUSE
  GOTO :BEGIN
)
