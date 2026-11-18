@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
title NEXORA - envio automatico para o GitHub

rem ================================================================
rem  NEXORA - envia as alteracoes para o GitHub automaticamente
rem  Coloque este arquivo na pasta do projeto e de dois cliques.
rem  Para parar: feche a janela ou aperte Ctrl+C.
rem ================================================================

rem ---------- AJUSTES ----------
rem  Intervalo entre as verificacoes, em minutos
set "MINUTOS=10"
rem  Branch do GitHub (normalmente main)
set "BRANCH=main"
rem  Arquivo de registro (fica fora do GitHub pelo .gitignore)
set "LOG=subir-auto.log"
rem -----------------------------

cd /d "%~dp0"

rem ---- 1. Confere se o Git esta instalado
where git >nul 2>&1
if errorlevel 1 (
  echo.
  echo  [ERRO] O Git nao esta instalado.
  echo         Baixe em https://git-scm.com e instale clicando em "Next" em tudo.
  echo.
  pause
  exit /b 1
)

rem ---- 2. Confere se a pasta e um repositorio do GitHub
git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
  echo.
  echo  [ERRO] Esta pasta nao esta ligada a um repositorio do GitHub.
  echo         Use o GitHub Desktop: File ^> Clone repository, e coloque este arquivo na pasta clonada.
  echo.
  pause
  exit /b 1
)
git remote get-url origin >nul 2>&1
if errorlevel 1 (
  echo.
  echo  [ERRO] O repositorio nao tem o endereco do GitHub ^(origin^).
  echo.
  pause
  exit /b 1
)

rem ---- 3. Identidade do autor (pede so na primeira vez)
for /f "delims=" %%n in ('git config user.name 2^>nul') do set "GNOME=%%n"
if not defined GNOME (
  set /p "GNOME=Seu nome para o historico do GitHub: "
  git config user.name "!GNOME!"
)
for /f "delims=" %%e in ('git config user.email 2^>nul') do set "GMAIL=%%e"
if not defined GMAIL (
  set /p "GMAIL=Seu e-mail do GitHub: "
  git config user.email "!GMAIL!"
)

set /a ESPERA=MINUTOS*60
for /f "delims=" %%u in ('git remote get-url origin') do set "URL=%%u"
cls
echo ================================================================
echo   NEXORA - envio automatico para o GitHub
echo ================================================================
echo   Pasta : %CD%
echo   GitHub: %URL%  (branch %BRANCH%)
echo   Verifica a cada %MINUTOS% minuto(s). Feche a janela para parar.
echo ================================================================
call :log "Iniciado"

:loop
echo.
echo [%date% %time:~0,8%] Verificando...

rem ---- Nao mexe se houver conflito pendente
if exist ".git\MERGE_HEAD" goto conflito
if exist ".git\rebase-merge" goto conflito
if exist ".git\rebase-apply" goto conflito

rem ---- 4. Prepara tudo que mudou (respeita o .gitignore)
git add -A >nul 2>&1

git diff --cached --quiet
if errorlevel 1 (
  rem ---- monta a mensagem com a quantidade de arquivos
  set /a NARQ=0
  for /f %%f in ('git diff --cached --name-only') do set /a NARQ+=1
  set "MSG=Atualizacao automatica - !NARQ! arquivo(s) - %date% %time:~0,5%"
  echo   Arquivos alterados:
  git diff --cached --name-status
  git commit -q -m "!MSG!"
  if errorlevel 1 (
    echo   [ERRO] Nao consegui registrar as alteracoes.
    call :log "ERRO no commit"
    goto espera
  )
  call :log "Commit: !MSG!"
) else (
  echo   Nada novo para registrar.
)

rem ---- 5. Traz o que mudou no GitHub antes de enviar (evita conflito)
git fetch -q origin %BRANCH% >nul 2>&1
if errorlevel 1 (
  echo   [AVISO] Sem conexao com o GitHub agora. Tento de novo depois.
  call :log "Sem conexao"
  goto espera
)
git pull -q --rebase --autostash origin %BRANCH% >nul 2>&1
if errorlevel 1 (
  git rebase --abort >nul 2>&1
  goto conflito
)

rem ---- 6. Envia so se houver algo que o GitHub ainda nao tem
set "PENDENTES=0"
for /f %%c in ('git rev-list --count origin/%BRANCH%..HEAD 2^>nul') do set "PENDENTES=%%c"
if "!PENDENTES!"=="0" (
  echo   GitHub ja esta atualizado.
  goto espera
)

set "TENT=0"
:enviar
set /a TENT+=1
git push -q origin HEAD:%BRANCH%
if errorlevel 1 (
  if !TENT! LSS 3 (
    echo   [AVISO] Falha ao enviar. Nova tentativa em 30 segundos ^(!TENT!/3^)...
    timeout /t 30 /nobreak >nul
    goto enviar
  )
  echo   [ERRO] Nao consegui enviar. Confira a internet e o login do GitHub.
  call :log "ERRO no push"
  goto espera
)
echo   [OK] !PENDENTES! envio(s) subiram para o GitHub.
call :log "Push OK: !PENDENTES! commit(s)"

:espera
echo   Proxima verificacao em %MINUTOS% minuto(s)...
timeout /t %ESPERA% >nul
goto loop

:conflito
echo.
echo  [ATENCAO] Ha um conflito: algo foi alterado no GitHub e no seu PC ao mesmo tempo.
echo            Abra o GitHub Desktop, resolva o conflito e depois aperte uma tecla aqui.
call :log "Conflito - aguardando"
pause
goto loop

:log
>>"%LOG%" echo [%date% %time:~0,8%] %~1
exit /b
