@echo off
setlocal enabledelayedexpansion
title AI Academic Digital Twin v28 - Launcher
color 0B
chcp 65001 >nul

:: ============================================================
:: CONFIGURATION
:: ============================================================
set "PROJECT_ROOT=%~dp0"
if "%PROJECT_ROOT:~-1%"=="\" set "PROJECT_ROOT=%PROJECT_ROOT:~0,-1%"
set "ML_PORT=8000"
set "APP_PORT=3000"

echo.
echo ============================================================
echo   AI Academic Digital Twin v28 - Launcher
echo ============================================================
echo   Project: %PROJECT_ROOT%
echo   Time:    %DATE% %TIME%
echo.

:: ============================================================
:: [1/8] ENVIRONMENT CHECKS
:: ============================================================
echo [1/8] Checking environment...

where node >nul 2>&1
if errorlevel 1 (
    echo    [FAIL] Node.js not found. Install from https://nodejs.org
    goto :fail
)
for /f "tokens=*" %%v in ('node --version 2^>nul') do echo    [OK] Node %%v

where npm >nul 2>&1
if errorlevel 1 (
    echo    [FAIL] npm not found
    goto :fail
)

where python >nul 2>&1
if errorlevel 1 (
    echo    [WARN] Python not found. ML service will be skipped.
    set "HAS_PYTHON=0"
) else (
    for /f "tokens=*" %%v in ('python --version 2^>nul') do echo    [OK] %%v
    set "HAS_PYTHON=1"
)

:: ============================================================
:: [2/8] PROJECT INTEGRITY
:: ============================================================
echo.
echo [2/8] Verifying project structure...

if not exist "%PROJECT_ROOT%\package.json" (
    echo    [FAIL] package.json missing at %PROJECT_ROOT%
    echo    This is not a valid project folder.
    goto :fail
)
if not exist "%PROJECT_ROOT%\prisma\schema.prisma" (
    echo    [FAIL] prisma\schema.prisma missing
    goto :fail
)
if not exist "%PROJECT_ROOT%\src" (
    echo    [FAIL] src\ folder missing
    goto :fail
)
echo    [OK] package.json, prisma schema, src/

:: ============================================================
:: [3/8] .ENV FILE
:: ============================================================
echo.
echo [3/8] Checking .env...

if not exist "%PROJECT_ROOT%\.env" (
    echo    [MISSING] .env not found. Creating template...
    (
        echo DATABASE_URL=""
        echo DIRECT_URL=""
        echo JWT_SECRET=""
        echo GROQ_API_KEY=""
        echo INTERNAL_SERVICE_SECRET=""
        echo ENABLE_LANGGRAPH_ORCHESTRATOR=false
    ) > "%PROJECT_ROOT%\.env"
    echo.
    echo    ============================================================
    echo    .env template created. You MUST fill in these values:
    echo      - DATABASE_URL   (from console.neon.tech - Direct connection)
    echo      - DIRECT_URL     (same as DATABASE_URL)
    echo      - JWT_SECRET     (run: python -c "import secrets; print(secrets.token_hex(32))")
    echo      - GROQ_API_KEY   (from console.groq.com)
    echo      - INTERNAL_SERVICE_SECRET  (run the python command again)
    echo    ============================================================
    echo.
    echo    Opening .env in Notepad now...
    timeout /t 2 /nobreak >nul
    notepad "%PROJECT_ROOT%\.env"
    echo.
    echo    Press any key once you have SAVED and CLOSED the .env file...
    pause >nul
)

:: Verify .env has content
for %%A in ("%PROJECT_ROOT%\.env") do set "ENV_SIZE=%%~zA"
if !ENV_SIZE! LSS 100 (
    echo    [FAIL] .env file is empty or too small (!ENV_SIZE! bytes)
    echo    Open it manually and fill in the required values:
    echo      notepad "%PROJECT_ROOT%\.env"
    goto :fail
)
echo    [OK] .env exists (!ENV_SIZE! bytes)

:: Check for empty critical keys
findstr /C:"DATABASE_URL=\"\"" "%PROJECT_ROOT%\.env" >nul 2>&1
if not errorlevel 1 (
    echo    [FAIL] DATABASE_URL is empty in .env
    goto :fail
)
findstr /C:"GROQ_API_KEY=\"\"" "%PROJECT_ROOT%\.env" >nul 2>&1
if not errorlevel 1 (
    echo    [WARN] GROQ_API_KEY is empty - LLM features will use fallback
)

:: ============================================================
:: [4/8] NODE DEPENDENCIES
:: ============================================================
echo.
echo [4/8] Checking Node dependencies...

if not exist "%PROJECT_ROOT%\node_modules" (
    echo    [MISSING] node_modules not found
    echo    Installing dependencies (this may take 3-6 minutes)...
    pushd "%PROJECT_ROOT%"
    call npm install
    if errorlevel 1 (
        popd
        echo    [FAIL] npm install failed
        goto :fail
    )
    popd
    echo    [OK] npm install complete
) else (
    echo    [OK] node_modules present
)

:: ============================================================
:: [5/8] PRISMA CLIENT
:: ============================================================
echo.
echo [5/8] Checking Prisma Client...

if not exist "%PROJECT_ROOT%\node_modules\.prisma\client\index.js" (
    echo    [MISSING] Prisma Client not generated
    pushd "%PROJECT_ROOT%"
    call npx prisma generate
    if errorlevel 1 (
        popd
        echo    [FAIL] prisma generate failed - check .env DATABASE_URL
        goto :fail
    )
    popd
    echo    [OK] Prisma Client generated
) else (
    echo    [OK] Prisma Client present
)

:: ============================================================
:: [6/8] DATABASE MIGRATIONS
:: ============================================================
echo.
echo [6/8] Checking database state...

pushd "%PROJECT_ROOT%"

:: Try to check migration status (this needs DB reachable)
call npx prisma migrate status >nul 2>&1
if errorlevel 1 (
    echo    [WARN] Could not verify migrations (DB may be unreachable)
    echo    Attempting to apply migrations...
    call npx prisma migrate deploy
    if errorlevel 1 (
        popd
        echo    [FAIL] Migration failed. Check DATABASE_URL in .env
        echo    Common cause: Neon project asleep - open console.neon.tech to wake it
        goto :fail
    )
    echo    [OK] Migrations applied
) else (
    echo    [OK] Database migrations up to date
)

:: Check if tables are empty (offer to seed)
for /f "tokens=*" %%c in ('echo "SELECT COUNT(*) FROM students;" ^| npx prisma db execute --stdin --schema prisma\schema.prisma 2^>nul ^| findstr /R "[0-9]"') do set "STUDENT_COUNT=%%c"

popd

echo.
echo    Do you want to seed the database with demo data?
echo    (Press Y to seed, N to skip - skip if you already have data)
choice /C YN /N /M "    Seed database? [Y/N]: "
if errorlevel 2 goto :skip_seed
if errorlevel 1 (
    pushd "%PROJECT_ROOT%"
    echo    Seeding...
    call npx prisma db seed
    if errorlevel 1 (
        echo    [WARN] Seed failed - continuing without seed
    ) else (
        echo    [OK] Database seeded
    )
    popd
)
:skip_seed

:: ============================================================
:: [7/8] PYTHON ML ENVIRONMENT
:: ============================================================
echo.
echo [7/8] Checking Python ML environment...

if "%HAS_PYTHON%"=="0" (
    echo    [SKIP] Python not available - ML service will not start
    goto :skip_ml
)

if not exist "%PROJECT_ROOT%\ml\.venv\Scripts\python.exe" (
    echo    [MISSING] ml\.venv not found
    echo    Do you want to set up the Python environment now?
    echo    (This takes 3-6 minutes and downloads ~200 MB of ML packages)
    choice /C YN /N /M "    Setup ML venv? [Y/N]: "
    if errorlevel 2 goto :skip_ml
    if errorlevel 1 (
        pushd "%PROJECT_ROOT%\ml"
        echo    Creating venv...
        python -m venv .venv
        if errorlevel 1 (
            popd
            echo    [WARN] venv creation failed - ML service will not start
            goto :skip_ml
        )
        echo    Installing packages...
        call .venv\Scripts\activate.bat
        pip install -r requirements.txt
        if errorlevel 1 (
            popd
            echo    [WARN] pip install failed - ML service will not start
            goto :skip_ml
        )
        call .venv\Scripts\deactivate.bat
        popd
        echo    [OK] ML venv ready
    )
) else (
    echo    [OK] ml\.venv present
)

:skip_ml

:: ============================================================
:: [8/8] PORT CHECKS
:: ============================================================
echo.
echo [8/8] Checking port availability...

netstat -ano | findstr ":%ML_PORT% " | findstr LISTENING >nul
if not errorlevel 1 (
    echo    [WARN] Port %ML_PORT% already in use - ML may fail to bind
    echo           (Run stop.bat first, or close the app using this port)
)

netstat -ano | findstr ":%APP_PORT% " | findstr LISTENING >nul
if not errorlevel 1 (
    echo    [WARN] Port %APP_PORT% already in use - Next.js will use %APP_PORT%+1
)

:: ============================================================
:: LAUNCH SERVICES
:: ============================================================
echo.
echo ============================================================
echo   All checks passed. Launching services...
echo ============================================================
echo.

:: ML service
if exist "%PROJECT_ROOT%\ml\.venv\Scripts\python.exe" (
    echo Starting ML service on port %ML_PORT%...
    start "ML Service [port %ML_PORT%]" /d "%PROJECT_ROOT%\ml" cmd /k ".venv\Scripts\python.exe -m uvicorn server:app --host 0.0.0.0 --port %ML_PORT% --reload"
    timeout /t 4 /nobreak >nul
) else (
    echo [SKIP] ML service (no venv)
)

:: Next.js
echo Starting Next.js on port %APP_PORT%...
start "Next.js [port %APP_PORT%]" /d "%PROJECT_ROOT%" cmd /k "npm run dev"
timeout /t 6 /nobreak >nul

:: Prisma Studio
echo Starting Prisma Studio...
start "Prisma Studio [port 5555]" /d "%PROJECT_ROOT%" cmd /k "npx prisma studio"
timeout /t 4 /nobreak >nul

:: Browser
echo Opening browser...
start "" "http://localhost:%APP_PORT%"

echo.
echo ============================================================
echo   ALL SERVICES LAUNCHED
echo ============================================================
echo.
echo   App:             http://localhost:%APP_PORT%
if exist "%PROJECT_ROOT%\ml\.venv\Scripts\python.exe" (
    echo   ML Service:      http://localhost:%ML_PORT%
    echo   ML API Docs:     http://localhost:%ML_PORT%/docs
)
echo   Prisma Studio:   http://localhost:5555
echo.
echo   3 new windows have opened.
echo   Close them individually OR run stop.bat to shut everything down.
echo.
echo ============================================================
echo.
pause
goto :eof

:fail
echo.
echo ============================================================
echo   LAUNCH FAILED
echo ============================================================
echo.
echo   Fix the issues above, then run start.bat again.
echo.
pause
exit /b 1