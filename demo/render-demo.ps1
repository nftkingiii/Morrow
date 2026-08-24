param(
  [string]$EdgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
  [string]$FfmpegPath = "C:\Users\HP\Downloads\ffmpeg\ffmpeg-8.1.2-essentials_build\bin\ffmpeg.exe"
)

$ErrorActionPreference = "Stop"
$demoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $demoRoot
$renderRoot = Join-Path $demoRoot "render"
$sceneRoot = Join-Path $renderRoot "scenes"
$audioRoot = Join-Path $renderRoot "audio"
$clipRoot = Join-Path $renderRoot "clips"
New-Item -ItemType Directory -Force -Path $sceneRoot,$audioRoot,$clipRoot | Out-Null

$narration = Get-Content -Raw (Join-Path $demoRoot "narration.json") | ConvertFrom-Json
$storyboard = (New-Object System.Uri((Join-Path $demoRoot "storyboard.html"))).AbsoluteUri

for ($i = 0; $i -lt $narration.Count; $i++) {
  $sceneNumber = $i.ToString("00")
  $scenePath = Join-Path $sceneRoot "$sceneNumber.png"
  & $EdgePath --headless --disable-gpu --hide-scrollbars --window-size=1920,1080 --screenshot=$scenePath "$storyboard`?scene=$i" | Out-Null
  for ($attempt = 0; $attempt -lt 20 -and -not (Test-Path $scenePath); $attempt++) {
    Start-Sleep -Milliseconds 250
  }
  if (-not (Test-Path $scenePath)) { throw "Scene $sceneNumber did not render." }

  Add-Type -AssemblyName System.Speech
  $voice = New-Object System.Speech.Synthesis.SpeechSynthesizer
  $voice.Rate = -1
  $voice.Volume = 100
  $audioPath = Join-Path $audioRoot "$sceneNumber.wav"
  $voice.SetOutputToWaveFile($audioPath)
  $voice.Speak([string]$narration[$i])
  $voice.Dispose()

  $duration = [double](& $FfmpegPath.Replace("ffmpeg.exe", "ffprobe.exe") -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 $audioPath)
  $clipPath = Join-Path $clipRoot "$sceneNumber.mp4"
  & $FfmpegPath -y -loop 1 -framerate 30 -i $scenePath -i $audioPath -filter_complex "[0:v]scale=1920:1080,zoompan=z='min(zoom+0.00008,1.012)':d=1:s=1920x1080:fps=30,format=yuv420p[v];[1:a]apad=pad_dur=0.8[a]" -map "[v]" -map "[a]" -t ($duration + 0.8) -c:v libx264 -preset medium -crf 18 -c:a aac -b:a 192k -movflags +faststart $clipPath | Out-Null
}

$concatPath = Join-Path $renderRoot "concat.txt"
$concatLines = Get-ChildItem $clipRoot -Filter "*.mp4" | Sort-Object Name | ForEach-Object { "file '$($_.FullName.Replace("'", "''"))'" }
Set-Content -Encoding utf8 $concatPath $concatLines
$rawPath = Join-Path $demoRoot "morrow-demo-raw.mp4"
& $FfmpegPath -y -f concat -safe 0 -i $concatPath -c copy -movflags +faststart $rawPath | Out-Null

# Synthetic narration is intentionally generated slowly for clarity, then the
# whole cut is tightened to stay below the sprint's three-minute limit.
$outputPath = Join-Path $demoRoot "morrow-demo-3min.mp4"
& $FfmpegPath -y -i $rawPath -filter_complex "[0:v]setpts=PTS/1.35[v];[0:a]atempo=1.35[a]" -map "[v]" -map "[a]" -c:v libx264 -preset veryfast -crf 19 -c:a aac -b:a 160k -movflags +faststart $outputPath | Out-Null
Write-Output $outputPath
