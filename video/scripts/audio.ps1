# Synthesizes one WAV per sentence with Windows SAPI (Microsoft Sabina Desktop, es-MX) into work/audio/<scene>_<n>.wav
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File video/scripts/audio.ps1 [-Rate 0] [-Video <id>]
# -Video: a tutorial under video/tutoriales/<id> (scenes.json there, audio in work/<id>/audio). Default: the original tutorial.
param([int]$Rate = 2, [string]$Video = "")
Add-Type -AssemblyName System.Speech
$root = Split-Path -Parent $PSScriptRoot
$out = if ($Video) { Join-Path $root "work\$Video\audio" } else { Join-Path $root "work\audio" }
$scenesFile = if ($Video) { Join-Path $root "tutoriales\$Video\scenes.json" } else { Join-Path $PSScriptRoot "scenes.json" }
New-Item -ItemType Directory -Force $out | Out-Null
Get-ChildItem $out -Filter *.wav -ErrorAction SilentlyContinue | Remove-Item
$scenes = Get-Content -Raw -Encoding UTF8 $scenesFile | ConvertFrom-Json
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.SelectVoice("Microsoft Sabina Desktop")
$synth.Rate = $Rate
foreach ($scene in $scenes.PSObject.Properties) {
  $i = 0
  foreach ($f in $scene.Value) {
    $text = if ($f.s) { $f.s } else { $f.t }
    $synth.SetOutputToWaveFile((Join-Path $out ("{0}_{1}.wav" -f $scene.Name, $i)))
    $synth.Speak($text)
    $synth.SetOutputToNull()
    $i++
  }
}
$synth.Dispose()
Write-Host "audio ok -> $out"
