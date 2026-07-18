@echo off
rem Runs the built AgentBoard server (API + UI on http://127.0.0.1:4173).
rem Build first with: npm run build
cd /d "%~dp0"
node dist\server\index.js
