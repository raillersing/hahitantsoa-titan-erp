# erp-antigravity-windows-wsl-adapter.ps1
# Windows-hosted audited entrypoint for Antigravity Windows-to-WSL adapter wrapper.

[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("task-start", "finalize-pr", "repo-status", "pr-checks", "pr-create", "task-branch-start", "frontend-quality")]
    [string]$Mode,

    [Parameter(Mandatory=$false)]
    [int]$PrNumber,

    [Parameter(Mandatory=$false)]
    [string]$TaskBranch,

    [Parameter(Mandatory=$false)]
    [string[]]$Allow,

    [Parameter(Mandatory=$false)]
    [string]$TaskWorktree,

    [Parameter(Mandatory=$false)]
    [string]$PrHead,

    [Parameter(Mandatory=$false)]
    [string]$PrBase = "main",

    [Parameter(Mandatory=$false)]
    [string]$PrTitle,

    [Parameter(Mandatory=$false)]
    [string]$PrBody,

    [Parameter(Mandatory=$false)]
    [string]$TaskBase = "main"
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
if ($Mode -eq "pr-checks") {
    if (-not $PrNumber) {
        Write-Error "PrNumber is required for pr-checks mode."
        exit 2
    }
}
if ($Mode -eq "pr-create") {
    if (-not $PrHead) {
        Write-Error "PrHead is required for pr-create mode."
        exit 2
    }
    if ($PrHead -eq "main" -or $PrHead -eq "master") {
        Write-Error "PrHead cannot be 'main' or 'master'."
        exit 2
    }
    if ($PrBase -ne "main") {
        Write-Error "PrBase must be 'main'."
        exit 2
    }
    if (-not $PrTitle) {
        Write-Error "PrTitle is required for pr-create mode."
        exit 2
    }
    if (-not $PrBody) {
        Write-Error "PrBody is required for pr-create mode."
        exit 2
    }
}
if ($Mode -eq "task-branch-start") {
    if (-not $TaskBranch) {
        Write-Error "TaskBranch is required for task-branch-start mode."
        exit 2
    }
    if ($TaskBranch -eq "main" -or $TaskBranch -eq "master") {
        Write-Error "TaskBranch cannot be 'main' or 'master'."
        exit 2
    }
    if ($TaskBase -ne "main") {
        Write-Error "TaskBase must be 'main'."
        exit 2
    }
}

# Resolve the WSL path dynamically from the script location
$WslAdapterPath = $PSScriptRoot.Replace("\", "/").Replace("Y:", "").Replace("//wsl$/Ubuntu", "").Replace("//wsl.localhost/Ubuntu", "") + "/erp-antigravity-wsl-adapter"

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
if ($Mode -eq "pr-checks") {
    $ArgList += $PrNumber.ToString()
}
if ($Mode -eq "pr-create") {
    $ArgList += $PrHead
    $ArgList += $PrBase
    $ArgList += $PrTitle
    $ArgList += $PrBody
}
if ($Mode -eq "task-branch-start") {
    $ArgList += $TaskBranch
    if ($TaskWorktree) {
        $ArgList += "--task-worktree"
        $ArgList += $TaskWorktree
    }
    $ArgList += "--task-base"
    $ArgList += $TaskBase
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
