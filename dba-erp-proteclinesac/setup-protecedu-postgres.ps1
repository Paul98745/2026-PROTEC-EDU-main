param(
    [string]$RepoRoot = (Get-Location).Path,
    [string]$PostgresBin = "C:\Program Files\PostgreSQL\18\bin",
    [string]$AdminUser = "postgres",
    [string]$HostName = "127.0.0.1",
    [int]$Port = 5433
)

$ErrorActionPreference = "Stop"

function Write-Step($message) {
    Write-Host ""
    Write-Host "==> $message" -ForegroundColor Cyan
}

function Assert-PathExists($path, $label) {
    if (-not (Test-Path $path)) {
        throw "$label no encontrado en: $path"
    }
}

function SecureToPlain([Security.SecureString]$secure) {
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }
}

$psql = Join-Path $PostgresBin "psql.exe"
$pgIsReady = Join-Path $PostgresBin "pg_isready.exe"
$backendDir = Join-Path $RepoRoot "backend-erp-proteclinesac"
$envPath = Join-Path $backendDir ".env"

Assert-PathExists $psql "psql.exe"
Assert-PathExists $pgIsReady "pg_isready.exe"
Assert-PathExists $backendDir "apps\backend"

Write-Step "Verificando PostgreSQL en ${HostName}:$Port"
& $pgIsReady -h $HostName -p $Port
if ($LASTEXITCODE -ne 0) {
    throw "PostgreSQL no está aceptando conexiones en ${HostName}:$Port."
}

Write-Step "Solicitando contraseña del administrador local"
$adminSecure = Read-Host "Contraseña de PostgreSQL para '$AdminUser'" -AsSecureString
$adminPassword = SecureToPlain $adminSecure
$env:PGPASSWORD = $adminPassword

try {
    Write-Step "Creando o ajustando el rol protecedu_app"

    $roleExists = & $psql -h $HostName -p $Port -U $AdminUser -d postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='protecedu_app';"
    if ($LASTEXITCODE -ne 0) {
        throw "No fue posible consultar los roles de PostgreSQL."
    }

    if ("$roleExists".Trim() -eq "1") {
        & $psql -h $HostName -p $Port -U $AdminUser -d postgres -v ON_ERROR_STOP=1 `
          -c "ALTER ROLE protecedu_app WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT;"
    } else {
        & $psql -h $HostName -p $Port -U $AdminUser -d postgres -v ON_ERROR_STOP=1 `
          -c "CREATE ROLE protecedu_app WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT;"
    }

    if ($LASTEXITCODE -ne 0) {
        throw "No fue posible crear/configurar protecedu_app."
    }

    Write-Step "Asignando contraseña a protecedu_app de forma interactiva"
    Write-Host "Se abrirá psql. Introduce una nueva contraseña dos veces cuando la solicite."
    Write-Host "La contraseña no se mostrará y no se incluirá en el comando."
    & $psql -h $HostName -p $Port -U $AdminUser -d postgres -c "\password protecedu_app"
    if ($LASTEXITCODE -ne 0) {
        throw "No fue posible establecer la contraseña de protecedu_app."
    }

    Write-Step "Creando las bases dev/shadow/test"

    $dbNames = @("protecedu_dev", "protecedu_shadow", "protecedu_test")

    foreach ($db in $dbNames) {
        $exists = & $psql -h $HostName -p $Port -U $AdminUser -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$db';"
        if ($LASTEXITCODE -ne 0) {
            throw "No fue posible verificar la base $db."
        }

        if ("$exists".Trim() -ne "1") {
            & $psql -h $HostName -p $Port -U $AdminUser -d postgres -v ON_ERROR_STOP=1 `
              -c "CREATE DATABASE $db OWNER protecedu_app;"
            if ($LASTEXITCODE -ne 0) {
                throw "No fue posible crear la base $db."
            }
        } else {
            Write-Host "$db ya existe; se conservará."
            & $psql -h $HostName -p $Port -U $AdminUser -d postgres -v ON_ERROR_STOP=1 `
              -c "ALTER DATABASE $db OWNER TO protecedu_app;"
        }

        & $psql -h $HostName -p $Port -U $AdminUser -d postgres -v ON_ERROR_STOP=1 `
          -c "REVOKE ALL ON DATABASE $db FROM PUBLIC; GRANT CONNECT, TEMPORARY ON DATABASE $db TO protecedu_app;"

        if ($LASTEXITCODE -ne 0) {
            throw "No fue posible ajustar permisos de $db."
        }
    }

    Write-Step "Creando backend-erp-proteclinesac/.env local"
    Write-Host "Introduce AHORA la misma contraseña que acabas de asignar a protecedu_app."
    $appSecure = Read-Host "Contraseña de protecedu_app" -AsSecureString
    $appPassword = SecureToPlain $appSecure

    if ([string]::IsNullOrWhiteSpace($appPassword)) {
        throw "La contraseña no puede estar vacía."
    }

    $encodedPassword = [System.Uri]::EscapeDataString($appPassword)
    $base = "postgresql://protecedu_app:${encodedPassword}@${HostName}:${Port}"

    @"
NODE_ENV=development
PORT=3000
DATABASE_URL=$base/protecedu_dev?schema=public
SHADOW_DATABASE_URL=$base/protecedu_shadow?schema=public
TEST_DATABASE_URL=$base/protecedu_test?schema=public
"@ | Set-Content -LiteralPath $envPath -Encoding UTF8

    Write-Host ".env creado en backend-erp-proteclinesac/.env (debe permanecer ignorado por Git)."

    Write-Step "Verificando conexión a las tres bases"
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    $env:PGPASSWORD = $appPassword

    foreach ($db in $dbNames) {
        & $psql -h $HostName -p $Port -U "protecedu_app" -d $db -v ON_ERROR_STOP=1 `
          -P pager=off `
          -c "SELECT current_database(), current_user;"
        if ($LASTEXITCODE -ne 0) {
            throw "Falló la conexión de protecedu_app a $db. Verifica la contraseña introducida."
        }
    }

    Write-Step "Ejecutando validaciones iniciales del proyecto"
    Push-Location $RepoRoot
    try {
        npm --prefix backend-erp-proteclinesac run db:targets:check
        if ($LASTEXITCODE -ne 0) { throw "db:targets:check falló." }

        npm --prefix backend-erp-proteclinesac run db:check
        if ($LASTEXITCODE -ne 0) { throw "db:check falló." }

        npm --prefix backend-erp-proteclinesac run prisma:validate
        if ($LASTEXITCODE -ne 0) { throw "prisma:validate falló." }

        npm --prefix backend-erp-proteclinesac run prisma:generate
        if ($LASTEXITCODE -ne 0) { throw "prisma:generate falló." }

        npm --prefix backend-erp-proteclinesac run prisma:status
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "prisma:status devolvió un estado no exitoso. Si aún no existen migraciones, revísalo antes de continuar."
        }
    }
    finally {
        Pop-Location
    }

    Write-Host ""
    Write-Host "PostgreSQL local de ProtecEdu quedó provisionado." -ForegroundColor Green
    Write-Host "Bases: protecedu_dev, protecedu_shadow, protecedu_test"
    Write-Host "Siguiente paso: continuar el BUILD desde la migración create-only."
}
finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    $adminPassword = $null
    $appPassword = $null
}
