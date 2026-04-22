@echo off
chcp 65001 > nul
title Incruit Jobpost Editor - 로컬 개발 서버

echo ================================================
echo  Incruit Jobpost Editor - 로컬 개발 서버
echo ================================================
echo.

:: Python 확인
python --version > nul 2>&1
if errorlevel 1 (
    echo [오류] Python이 설치되어 있지 않습니다.
    pause
    exit /b 1
)

:: 의존성 확인
python -c "import flask, docx, openpyxl, pdfplumber" > nul 2>&1
if errorlevel 1 (
    echo [설치] 필요한 패키지를 설치합니다...
    pip install python-docx openpyxl pdfplumber flask
    echo.
)

:: 기존 서버 프로세스 종료
echo [시작] 기존 서버 프로세스 정리 중...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8787 " 2^>nul') do taskkill /PID %%a /F > nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8082 " 2^>nul') do taskkill /PID %%a /F > nul 2>&1
timeout /t 1 /nobreak > nul

:: CORS 프록시 서버 시작 (8787 포트 - 정적파일 + API 프록시)
echo [시작] 웹 서버 (port 8787)...
start "CORS Proxy" cmd /k "cd /d %~dp0 && python cors-proxy.py"

:: 변환 서버 시작 (8082 포트 - HWP/DOCX 변환)
echo [시작] 변환 서버 (port 8082)...
start "Convert Server" cmd /k "cd /d %~dp0 && python convert-server.py"

:: 잠시 대기 후 브라우저 열기
timeout /t 2 /nobreak > nul
echo.
echo ================================================
echo  서버 시작 완료!
echo  브라우저: http://localhost:8787
echo ================================================
echo.

:: 브라우저 열기
start http://localhost:8787

echo 서버를 종료하려면 각 터미널 창을 닫으세요.
pause
