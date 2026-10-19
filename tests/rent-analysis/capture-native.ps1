param([Parameter(Mandatory=$true)][ValidatePattern('^[a-z0-9-]+$')][string]$Name)
# Invoke through Windows MCP only while holding the desktop lease.
# Match physical screen pixels at non-100% Windows scaling, before WinForms caches bounds.
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class RentCaptureDpi {
    [DllImport("user32.dll")]
    public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
}
'@
$previousDpiContext = [RentCaptureDpi]::SetThreadDpiAwarenessContext([IntPtr](-4))
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$captureDir = Join-Path $PSScriptRoot 'evidence'
New-Item -ItemType Directory -Force -Path $captureDir | Out-Null
$captureBounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$captureBitmap = New-Object System.Drawing.Bitmap $captureBounds.Width,$captureBounds.Height
$captureGraphics = [System.Drawing.Graphics]::FromImage($captureBitmap)
try {
  $captureGraphics.CopyFromScreen($captureBounds.Location,[System.Drawing.Point]::Empty,$captureBounds.Size)
  $captureBitmap.Save((Join-Path $captureDir "$Name.png"))
} finally {
  $captureGraphics.Dispose()
  $captureBitmap.Dispose()
  [RentCaptureDpi]::SetThreadDpiAwarenessContext($previousDpiContext) | Out-Null
}
