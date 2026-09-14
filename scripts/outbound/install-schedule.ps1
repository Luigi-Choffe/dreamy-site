# Dreamy Outbound - registra a tarefa agendada do Windows "DreamyOutboundAuto".
#
# COMO USAR: rode este script MANUALMENTE, uma unica vez, num PowerShell aberto
# pelo usuario que vai operar o outbound:
#   powershell -ExecutionPolicy Bypass -File scripts\outbound\install-schedule.ps1
#
# Requisitos:
#   - pnpm disponivel no PATH desse usuario (o mesmo que roda `pnpm dev`);
#   - a tarefa roda `pnpm outbound:auto` em DIAS UTEIS as 09:05, no diretorio do
#     repositorio, com log em .outbound\auto.log;
#   - desarmada (`pnpm outbound:arm status`), a automacao NAO dispara nada: armar
#     exige acao explicita do usuario (`pnpm outbound:arm arm --confirm`).
#
# Para remover a tarefa: schtasks.exe /Delete /TN "DreamyOutboundAuto" /F
# NAO execute este script por automacao/agente - registrar a tarefa e uma acao
# explicita do usuario (PRD-EMAIL-OUTBOUND, secao 20).

$ErrorActionPreference = "Stop"

$taskName = "DreamyOutboundAuto"
$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

if ($repo -match "\s") {
  Write-Host "ERRO: o caminho do repositorio contem espacos ($repo)."
  Write-Host "O /TR do schtasks nao aceita esse caminho sem aspas aninhadas; mova o repo ou registre a tarefa manualmente."
  exit 1
}

$pnpm = Get-Command pnpm -ErrorAction SilentlyContinue
if ($null -eq $pnpm) {
  Write-Host "ERRO: pnpm nao encontrado no PATH. Instale/exponha o pnpm antes de agendar."
  exit 1
}

# Wrapper .cmd evita o inferno de aspas do /TR e garante diretorio + log corretos.
$outboundDir = Join-Path $repo ".outbound"
if (-not (Test-Path $outboundDir)) {
  New-Item -ItemType Directory -Path $outboundDir | Out-Null
}
$runner = Join-Path $outboundDir "auto-task.cmd"
$lines = @(
  "@echo off",
  "cd /d ""$repo""",
  "pnpm outbound:auto >> ""$repo\.outbound\auto.log"" 2>&1"
)
Set-Content -Path $runner -Value $lines -Encoding Default

# Executor OCULTO (falha #14 de docs/FALHAS-E-SALVAGUARDAS.md): o .cmd abria uma
# janela de console e fecha-la matava o ciclo no meio. O .vbs roda o .cmd com a
# janela escondida, espera o fim e devolve o codigo de saida para a tarefa.
$hidden = Join-Path $outboundDir "auto-task.vbs"
$vbs = @(
  "' Dreamy Outbound - runs the scheduled cycle WITHOUT a console window (failure #14).",
  "Option Explicit",
  "Dim sh",
  "Set sh = CreateObject(""WScript.Shell"")",
  "WScript.Quit sh.Run(""cmd.exe /c $runner"", 0, True)"
)
Set-Content -Path $hidden -Value $vbs -Encoding Ascii

# Registro com todas as salvaguardas do registro de falhas:
#   #1  roda na bateria e recupera disparo perdido (StartWhenAvailable)
#   #6  tres gatilhos por dia util (09:05, 12:05, 15:05; o plano e idempotente)
#   #14 acao oculta via wscript
#   #15 acorda o PC da suspensao (WakeToRun; PC DESLIGADO continua sem ciclo)
$dias = "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"
$triggers = @(
  (New-ScheduledTaskTrigger -Weekly -DaysOfWeek $dias -At 09:05),
  (New-ScheduledTaskTrigger -Weekly -DaysOfWeek $dias -At 12:05),
  (New-ScheduledTaskTrigger -Weekly -DaysOfWeek $dias -At 15:05)
)
$action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "//B //Nologo ""$hidden""" -WorkingDirectory $repo
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -WakeToRun -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $triggers -Settings $settings -Force | Out-Null

Write-Host ""
Write-Host "Tarefa '$taskName' registrada: dias uteis, 09:05/12:05/15:05, oculta, acorda o PC, executando pnpm outbound:auto em $repo"
Write-Host "Log de execucao: $repo\.outbound\auto.log"
Write-Host "Conferir:        schtasks.exe /Query /TN $taskName /V /FO LIST"
Write-Host "Remover:         schtasks.exe /Delete /TN $taskName /F"
Write-Host ""
Write-Host "Lembrete: a automacao so envia e-mail real com o sistema ARMADO:"
Write-Host "  pnpm outbound:arm arm --confirm"
