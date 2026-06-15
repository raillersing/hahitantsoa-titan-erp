# erp-antigravity-windows-wsl-adapter.ps1
# Windows-hosted audited entrypoint for Antigravity Windows-to-WSL adapter wrapper.

[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("task-start", "finalize-pr")]
    [string]$Mode,

    [Parameter(Mandatory=$false)]
    [int]$PrNumber,

    [Parameter(Mandatory=$false)]
    [string]$TaskBranch,

    [Parameter(Mandatory=$false)]
    [string[]]$Allow,

    [Parameter(Mandatory=$false)]
    [string]$TaskWorktree
)

# Enforce parameters based on mode
if ($Mode -eq "finalize-pr") {
    if (-not $PrNumber) {
        Write-Error "PrNumber is required for finalize-pr mode."
        exit 2
    }
    if (-not $TaskBranch) {
        Write-Error "TaskBranch is required for finalize-pr mode."
        exit 2
    }
    if (-not $Allow -or $Allow.Length -eq 0) {
        Write-Error "At least one Allow path is required for finalize-pr mode."
        exit 2
    }
}

# Construct the WSL path for the bash entrypoint
$WslAdapterPath = "/home/raillersing/projects/hahitantsoa-titan-erp/scripts/dev/erp-antigravity-wsl-adapter"

# Construct argv parameters without shell command interpolation
$ArgList = @($Mode)

if ($Mode -eq "finalize-pr") {
    $ArgList += $PrNumber.ToString()
    $ArgList += $TaskBranch
    if ($TaskWorktree) {
        $ArgList += "--task-worktree"
        $ArgList += $TaskWorktree
    }
    foreach ($path in $Allow) {
        $ArgList += "--allow"
        $ArgList += $path
    }
}

# Build a flat array for Start-Process to avoid parameter binding issues
$WslArgs = @("--distribution", "Ubuntu", "--exec", "/bin/bash", $WslAdapterPath) + $ArgList

# Call wsl.exe using argv array safely
$WslProcess = Start-Process -FilePath "wsl.exe" -ArgumentList $WslArgs -NoNewWindow -PassThru -Wait

if ($null -eq $WslProcess) {
    Write-Error "Failed to launch wsl.exe"
    exit 1
}

exit $WslProcess.ExitCode
