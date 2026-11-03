@echo off
cd /d "%~dp0"
where py >nul 2>nul
if errorlevel 1 goto try_python
py -3 start_kene.py
goto done
:try_python
where python >nul 2>nul
if errorlevel 1 goto missing
python start_kene.py
goto done
:missing
echo Please install Python 3, then run this file again.
:done
pause
