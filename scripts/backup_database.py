#!/usr/bin/env python3
"""
PEPTIDE-PLUS DATABASE BACKUP v1.0
===================================
Automated backup of peptide-plus PostgreSQL database.

Schedule: 2x/day (8h00 + 20h00) via Aurelia master daemon
Sources: Docker local (port 5433) + Azure production
Destinations: Local + Azure Blob Storage

Usage:
    python3 backup_database.py                    # Backup local Docker DB
    python3 backup_database.py --local            # Backup local DB only
    python3 backup_database.py --azure            # Upload latest backup to Azure
    python3 backup_database.py --production       # Backup production Azure DB
    python3 backup_database.py --all              # Local + production + Azure upload
    python3 backup_database.py --status           # Show backup status
    python3 backup_database.py --list             # List all backups
    python3 backup_database.py --restore <file>   # Restore from backup file
    python3 backup_database.py --restore-latest   # Restore from latest backup
    python3 backup_database.py --cleanup          # Remove old backups per retention policy
    python3 backup_database.py --verify <file>    # Verify backup integrity
"""

import argparse
import gzip
import hashlib
import json
import logging
import os
import shutil
import subprocess
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Any, List, Optional

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

# =============================================================================
# CONFIGURATION
# =============================================================================

PROJECT_ROOT = Path("/Volumes/AI_Project/peptide-plus")
BACKUP_DIR = PROJECT_ROOT / "backups"
MANIFEST_FILE = BACKUP_DIR / "backup_manifest.json"

# Local Docker DB
LOCAL_DB = {
    "host": "localhost",
    "port": "5433",
    "name": "peptide_plus",
    "user": "peptide",
    "password": "peptide123",
}

# Production Azure DB (read from .env if available)
PRODUCTION_DB_URL_ENV = "DATABASE_URL"

# Azure Blob Storage
AZURE_CONTAINER = "peptide-backups"
AZURE_STORAGE_ACCOUNT = "lovepicsstorage"
AZURE_KEYCHAIN_SERVICE = "azure-blob-connection"
AZURE_KEYCHAIN_ACCOUNT = "aurelia-backup"

# Retention policy (commercial data = longer retention)
RETENTION = {
    "daily": 14,      # Keep 14 days of daily backups
    "weekly": 8,       # Keep 8 weeks of weekly backups (Sundays)
    "monthly": 6,      # Keep 6 months of monthly backups (1st of month)
}

BACKUP_DIR.mkdir(parents=True, exist_ok=True)


# =============================================================================
# HELPERS
# =============================================================================

def _sha256(filepath: str) -> str:
    """Calculate SHA256 hash of a file."""
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def _notify_macos(title: str, message: str):
    """Send macOS notification."""
    try:
        safe_title = str(title).replace('"', '\\"')[:100]
        safe_msg = str(message).replace('"', '\\"')[:200]
        script = f'display notification "{safe_msg}" with title "{safe_title}" sound name "Glass"'
        subprocess.Popen(["osascript", "-e", script],
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception:
        pass


def _get_azure_connection_string() -> Optional[str]:
    """Get Azure connection string from macOS Keychain."""
    try:
        proc = subprocess.run([
            "security", "find-generic-password",
            "-a", AZURE_KEYCHAIN_ACCOUNT,
            "-s", AZURE_KEYCHAIN_SERVICE,
            "-w",
        ], capture_output=True, text=True)
        if proc.returncode == 0 and proc.stdout.strip():
            return proc.stdout.strip()
    except Exception:
        pass
    return None


def _load_manifest() -> Dict:
    """Load backup manifest."""
    if MANIFEST_FILE.exists():
        try:
            return json.loads(MANIFEST_FILE.read_text())
        except Exception:
            pass
    return {"backups": [], "last_cleanup": None}


def _save_manifest(manifest: Dict):
    """Save backup manifest."""
    MANIFEST_FILE.write_text(json.dumps(manifest, indent=2, default=str))


def _get_production_db_url() -> Optional[str]:
    """Get production DATABASE_URL from .env file."""
    env_file = PROJECT_ROOT / ".env"
    if not env_file.exists():
        return None
    try:
        for line in env_file.read_text().split("\n"):
            line = line.strip()
            if line.startswith("DATABASE_URL=") and "localhost" not in line and "5433" not in line:
                url = line.split("=", 1)[1].strip().strip('"').strip("'")
                return url
    except Exception:
        pass
    return None


# =============================================================================
# BACKUP
# =============================================================================

def backup_local_db() -> Dict[str, Any]:
    """Backup local Docker PostgreSQL database."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    dump_file = BACKUP_DIR / f"peptide_local_{timestamp}.sql"
    gz_file = BACKUP_DIR / f"peptide_local_{timestamp}.sql.gz"

    result = {
        "type": "local",
        "timestamp": timestamp,
        "source": f"{LOCAL_DB['host']}:{LOCAL_DB['port']}/{LOCAL_DB['name']}",
    }

    try:
        # Check if Docker container is running
        docker_check = subprocess.run(
            ["docker", "ps", "--format", "{{.Names}}"],
            capture_output=True, text=True, timeout=10,
        )
        if "peptide" not in docker_check.stdout.lower() and "postgres" not in docker_check.stdout.lower():
            log.warning("PostgreSQL Docker container may not be running")

        # Run pg_dump
        env = {**os.environ, "PGPASSWORD": LOCAL_DB["password"]}
        proc = subprocess.run([
            "pg_dump",
            "-h", LOCAL_DB["host"],
            "-p", LOCAL_DB["port"],
            "-U", LOCAL_DB["user"],
            "-d", LOCAL_DB["name"],
            "--no-owner",
            "--no-acl",
            "-f", str(dump_file),
        ], capture_output=True, text=True, timeout=300, env=env)

        if proc.returncode != 0:
            result["status"] = "error"
            result["error"] = proc.stderr[:500]
            _notify_macos("Peptide-Plus Backup FAILED", proc.stderr[:100])
            return result

        # Compress with gzip
        with open(dump_file, "rb") as f_in:
            with gzip.open(str(gz_file), "wb") as f_out:
                shutil.copyfileobj(f_in, f_out)

        # Remove uncompressed
        dump_file.unlink()

        # Calculate SHA256
        sha = _sha256(str(gz_file))
        size = gz_file.stat().st_size

        result["file"] = str(gz_file)
        result["filename"] = gz_file.name
        result["size_bytes"] = size
        result["size_mb"] = round(size / 1024 / 1024, 2)
        result["sha256"] = sha
        result["status"] = "success"

        # Update manifest
        manifest = _load_manifest()
        manifest["backups"].append(result)
        manifest["last_local"] = datetime.now().isoformat()
        _save_manifest(manifest)

        log.info(f"Local backup: {gz_file.name} ({result['size_mb']} MB, SHA256: {sha[:16]}...)")
        return result

    except subprocess.TimeoutExpired:
        result["status"] = "error"
        result["error"] = "pg_dump timed out (>5 min)"
        _notify_macos("Peptide-Plus Backup TIMEOUT", "pg_dump took too long")
        return result
    except FileNotFoundError:
        result["status"] = "error"
        result["error"] = "pg_dump not found. Install: brew install postgresql"
        return result
    except Exception as e:
        result["status"] = "error"
        result["error"] = str(e)
        _notify_macos("Peptide-Plus Backup ERROR", str(e)[:100])
        return result


def backup_production_db() -> Dict[str, Any]:
    """Backup production Azure PostgreSQL database."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    dump_file = BACKUP_DIR / f"peptide_production_{timestamp}.sql"
    gz_file = BACKUP_DIR / f"peptide_production_{timestamp}.sql.gz"

    result = {
        "type": "production",
        "timestamp": timestamp,
    }

    db_url = _get_production_db_url()
    if not db_url:
        result["status"] = "error"
        result["error"] = "Production DATABASE_URL not found in .env"
        return result

    result["source"] = "azure_production"

    try:
        proc = subprocess.run([
            "pg_dump", db_url,
            "--no-owner", "--no-acl",
            "-f", str(dump_file),
        ], capture_output=True, text=True, timeout=600)

        if proc.returncode != 0:
            result["status"] = "error"
            # Mask connection string in error
            error = proc.stderr[:500]
            if db_url in error:
                error = error.replace(db_url, "***")
            result["error"] = error
            _notify_macos("Peptide-Plus PROD Backup FAILED", error[:100])
            return result

        # Compress
        with open(dump_file, "rb") as f_in:
            with gzip.open(str(gz_file), "wb") as f_out:
                shutil.copyfileobj(f_in, f_out)
        dump_file.unlink()

        sha = _sha256(str(gz_file))
        size = gz_file.stat().st_size

        result["file"] = str(gz_file)
        result["filename"] = gz_file.name
        result["size_bytes"] = size
        result["size_mb"] = round(size / 1024 / 1024, 2)
        result["sha256"] = sha
        result["status"] = "success"

        manifest = _load_manifest()
        manifest["backups"].append(result)
        manifest["last_production"] = datetime.now().isoformat()
        _save_manifest(manifest)

        log.info(f"Production backup: {gz_file.name} ({result['size_mb']} MB)")
        return result

    except subprocess.TimeoutExpired:
        result["status"] = "error"
        result["error"] = "Production pg_dump timed out (>10 min)"
        return result
    except Exception as e:
        result["status"] = "error"
        result["error"] = str(e)
        return result


def upload_to_azure(filepath: str) -> Dict[str, Any]:
    """Upload a backup file to Azure Blob Storage."""
    conn_str = _get_azure_connection_string()
    if not conn_str:
        return {
            "status": "error",
            "error": "Azure connection string not found in Keychain",
        }

    blob_name = Path(filepath).name
    size = Path(filepath).stat().st_size

    try:
        az_env = {**os.environ, "AZURE_STORAGE_CONNECTION_STRING": conn_str}

        # Ensure container exists
        subprocess.run([
            "az", "storage", "container", "create",
            "--name", AZURE_CONTAINER,
            "--public-access", "off",
        ], capture_output=True, text=True, timeout=30, env=az_env)

        # Upload
        log.info(f"Uploading {size / 1024 / 1024:.1f} MB to Azure: {blob_name}")
        proc = subprocess.run([
            "az", "storage", "blob", "upload",
            "--container-name", AZURE_CONTAINER,
            "--file", filepath,
            "--name", blob_name,
            "--overwrite", "true",
            "--tier", "Cool",
        ], capture_output=True, text=True, timeout=1800, env=az_env)

        if proc.returncode == 0:
            log.info(f"Uploaded to Azure: {blob_name}")
            return {
                "status": "uploaded",
                "blob": blob_name,
                "container": AZURE_CONTAINER,
                "size_mb": round(size / 1024 / 1024, 2),
            }
        else:
            stderr = proc.stderr.replace(conn_str, "***") if conn_str else proc.stderr
            return {"status": "error", "error": stderr[:500]}

    except FileNotFoundError:
        return {"status": "error", "error": "az CLI not found. Install: brew install azure-cli"}
    except Exception as e:
        return {"status": "error", "error": str(e)}


# =============================================================================
# RESTORE
# =============================================================================

def restore_from_backup(filepath: str, target: str = "local") -> Dict[str, Any]:
    """Restore a database from a backup file.

    Args:
        filepath: Path to .sql.gz backup file
        target: 'local' (Docker port 5433) or 'production' (Azure)
    """
    path = Path(filepath)
    if not path.exists():
        return {"status": "error", "error": f"File not found: {filepath}"}

    result = {
        "file": filepath,
        "target": target,
        "timestamp": datetime.now().isoformat(),
    }

    try:
        # Verify integrity first
        sha = _sha256(filepath)
        result["sha256"] = sha

        # Decompress to temp file
        sql_file = path.with_suffix("")  # Remove .gz
        if str(path).endswith(".gz"):
            with gzip.open(str(path), "rb") as f_in:
                with open(str(sql_file), "wb") as f_out:
                    shutil.copyfileobj(f_in, f_out)
        else:
            sql_file = path

        if target == "local":
            env = {**os.environ, "PGPASSWORD": LOCAL_DB["password"]}
            proc = subprocess.run([
                "psql",
                "-h", LOCAL_DB["host"],
                "-p", LOCAL_DB["port"],
                "-U", LOCAL_DB["user"],
                "-d", LOCAL_DB["name"],
                "-f", str(sql_file),
            ], capture_output=True, text=True, timeout=600, env=env)
        elif target == "production":
            db_url = _get_production_db_url()
            if not db_url:
                return {"status": "error", "error": "Production DATABASE_URL not found"}
            proc = subprocess.run([
                "psql", db_url, "-f", str(sql_file),
            ], capture_output=True, text=True, timeout=600)
        else:
            return {"status": "error", "error": f"Unknown target: {target}"}

        # Cleanup temp sql file
        if str(path).endswith(".gz") and sql_file.exists():
            sql_file.unlink()

        if proc.returncode == 0:
            result["status"] = "restored"
            log.info(f"Database restored from {path.name} to {target}")
        else:
            result["status"] = "error"
            result["error"] = proc.stderr[:500]

        return result

    except Exception as e:
        result["status"] = "error"
        result["error"] = str(e)
        return result


def get_latest_backup(backup_type: str = "local") -> Optional[str]:
    """Get path to the latest backup file of given type."""
    pattern = f"peptide_{backup_type}_*.sql.gz"
    backups = sorted(BACKUP_DIR.glob(pattern), key=lambda f: f.stat().st_mtime)
    return str(backups[-1]) if backups else None


# =============================================================================
# VERIFY
# =============================================================================

def verify_backup(filepath: str) -> Dict[str, Any]:
    """Verify backup integrity."""
    path = Path(filepath)
    if not path.exists():
        return {"status": "error", "error": f"File not found: {filepath}"}

    result = {
        "file": filepath,
        "filename": path.name,
    }

    try:
        # Check file size
        size = path.stat().st_size
        result["size_bytes"] = size
        result["size_mb"] = round(size / 1024 / 1024, 2)

        if size == 0:
            result["status"] = "error"
            result["error"] = "File is empty"
            return result

        # SHA256
        sha = _sha256(filepath)
        result["sha256"] = sha

        # Try to decompress and check SQL content
        if str(filepath).endswith(".gz"):
            with gzip.open(filepath, "rt", errors="replace") as f:
                first_lines = []
                for i, line in enumerate(f):
                    first_lines.append(line)
                    if i >= 10:
                        break

            content_preview = "".join(first_lines)
            has_sql = any(kw in content_preview for kw in [
                "PostgreSQL", "CREATE TABLE", "INSERT INTO",
                "pg_dump", "SET statement_timeout",
            ])
            result["valid_sql"] = has_sql
            result["preview"] = content_preview[:200]
        else:
            result["valid_sql"] = True  # Assume valid for non-gz

        result["status"] = "verified" if result.get("valid_sql", False) else "warning"
        return result

    except Exception as e:
        result["status"] = "error"
        result["error"] = str(e)
        return result


# =============================================================================
# CLEANUP (Retention Policy)
# =============================================================================

def cleanup_old_backups() -> Dict[str, Any]:
    """Remove old backups according to retention policy."""
    now = datetime.now()
    removed = []
    kept = []

    for gz_file in sorted(BACKUP_DIR.glob("peptide_*.sql.gz")):
        mtime = datetime.fromtimestamp(gz_file.stat().st_mtime)
        age_days = (now - mtime).days

        # Determine if this backup should be kept
        keep = False

        # Monthly: keep 1st-of-month backups for RETENTION["monthly"] months
        if mtime.day <= 1 and age_days <= RETENTION["monthly"] * 30:
            keep = True

        # Weekly: keep Sunday backups for RETENTION["weekly"] weeks
        elif mtime.weekday() == 6 and age_days <= RETENTION["weekly"] * 7:
            keep = True

        # Daily: keep all for RETENTION["daily"] days
        elif age_days <= RETENTION["daily"]:
            keep = True

        if keep:
            kept.append(gz_file.name)
        else:
            size = gz_file.stat().st_size
            gz_file.unlink()
            removed.append({"name": gz_file.name, "size_mb": round(size / 1024 / 1024, 2), "age_days": age_days})

    result = {
        "kept": len(kept),
        "removed": len(removed),
        "removed_files": removed,
        "freed_mb": round(sum(r["size_mb"] for r in removed), 2),
        "retention_policy": RETENTION,
    }

    if removed:
        log.info(f"Cleanup: removed {len(removed)} old backups, freed {result['freed_mb']} MB")

    # Update manifest
    manifest = _load_manifest()
    manifest["last_cleanup"] = now.isoformat()
    _save_manifest(manifest)

    return result


# =============================================================================
# STATUS
# =============================================================================

def get_status() -> Dict[str, Any]:
    """Get backup status."""
    backups = sorted(BACKUP_DIR.glob("peptide_*.sql.gz"), key=lambda f: f.stat().st_mtime)

    local_backups = [b for b in backups if "local" in b.name]
    prod_backups = [b for b in backups if "production" in b.name]

    total_size = sum(b.stat().st_size for b in backups)

    # Latest backup ages
    latest_local = None
    latest_prod = None
    if local_backups:
        latest_local = (datetime.now() - datetime.fromtimestamp(
            local_backups[-1].stat().st_mtime)).total_seconds() / 3600
    if prod_backups:
        latest_prod = (datetime.now() - datetime.fromtimestamp(
            prod_backups[-1].stat().st_mtime)).total_seconds() / 3600

    # Health
    if not backups:
        health = "CRITICAL"
        msg = "NO BACKUPS EXIST!"
    elif latest_local and latest_local > 24:
        health = "WARNING"
        msg = f"Local backup {latest_local:.0f}h old (>24h)"
    else:
        health = "OK"
        msg = f"Last local backup {latest_local:.1f}h ago" if latest_local else "Backups exist"

    return {
        "health": health,
        "message": msg,
        "counts": {
            "total": len(backups),
            "local": len(local_backups),
            "production": len(prod_backups),
        },
        "total_size_mb": round(total_size / 1024 / 1024, 1),
        "latest": {
            "local_hours_ago": round(latest_local, 1) if latest_local else None,
            "production_hours_ago": round(latest_prod, 1) if latest_prod else None,
        },
        "retention": RETENTION,
        "backup_dir": str(BACKUP_DIR),
    }


def list_backups() -> List[Dict]:
    """List all backup files with details."""
    backups = []
    for f in sorted(BACKUP_DIR.glob("peptide_*.sql.gz"), key=lambda x: x.stat().st_mtime, reverse=True):
        stat = f.stat()
        backups.append({
            "name": f.name,
            "size_mb": round(stat.st_size / 1024 / 1024, 2),
            "date": datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M"),
            "age_days": (datetime.now() - datetime.fromtimestamp(stat.st_mtime)).days,
            "path": str(f),
        })
    return backups


# =============================================================================
# CLI
# =============================================================================

def main():
    parser = argparse.ArgumentParser(description="Peptide-Plus Database Backup")
    parser.add_argument("--local", action="store_true", help="Backup local Docker DB")
    parser.add_argument("--production", action="store_true", help="Backup production Azure DB")
    parser.add_argument("--azure", action="store_true", help="Upload latest backup to Azure Blob")
    parser.add_argument("--all", action="store_true", help="Full backup: local + production + Azure")
    parser.add_argument("--status", action="store_true", help="Show backup status")
    parser.add_argument("--list", action="store_true", help="List all backups")
    parser.add_argument("--restore", type=str, help="Restore from backup file")
    parser.add_argument("--restore-latest", action="store_true", help="Restore from latest local backup")
    parser.add_argument("--target", choices=["local", "production"], default="local",
                        help="Restore target (default: local)")
    parser.add_argument("--verify", type=str, help="Verify backup integrity")
    parser.add_argument("--cleanup", action="store_true", help="Remove old backups")
    parser.add_argument("--json", action="store_true", help="JSON output")
    args = parser.parse_args()

    if args.status:
        status = get_status()
        if args.json:
            print(json.dumps(status, indent=2))
        else:
            print(f"\nPeptide-Plus DB Backup Status")
            print("=" * 50)
            print(f"  Health: {status['health']} - {status['message']}")
            print(f"  Backups: {status['counts']['total']} total ({status['counts']['local']} local, {status['counts']['production']} prod)")
            print(f"  Size: {status['total_size_mb']} MB")
            l = status['latest']
            if l['local_hours_ago']:
                print(f"  Last local: {l['local_hours_ago']}h ago")
            if l['production_hours_ago']:
                print(f"  Last production: {l['production_hours_ago']}h ago")
            print(f"  Dir: {status['backup_dir']}")

    elif args.list:
        backups = list_backups()
        if args.json:
            print(json.dumps(backups, indent=2))
        else:
            print(f"\nBackups ({len(backups)}):")
            print("-" * 70)
            for b in backups:
                print(f"  {b['date']}  {b['name']:45s}  {b['size_mb']:>8.2f} MB  ({b['age_days']}d)")

    elif args.local or (not any([args.production, args.azure, args.all, args.restore,
                                  args.restore_latest, args.verify, args.cleanup, args.status, args.list])):
        result = backup_local_db()
        if args.json:
            print(json.dumps(result, indent=2))
        else:
            if result["status"] == "success":
                print(f"Local backup OK: {result['filename']} ({result['size_mb']} MB)")
                print(f"  SHA256: {result['sha256'][:32]}...")
            else:
                print(f"Backup FAILED: {result.get('error', 'unknown')}")

    elif args.production:
        result = backup_production_db()
        if args.json:
            print(json.dumps(result, indent=2))
        else:
            if result["status"] == "success":
                print(f"Production backup OK: {result['filename']} ({result['size_mb']} MB)")
            else:
                print(f"Production backup FAILED: {result.get('error', 'unknown')}")

    elif args.azure:
        latest = get_latest_backup("local") or get_latest_backup("production")
        if not latest:
            print("No backup file found to upload")
            sys.exit(1)
        result = upload_to_azure(latest)
        if args.json:
            print(json.dumps(result, indent=2))
        else:
            if result["status"] == "uploaded":
                print(f"Uploaded: {result['blob']} ({result['size_mb']} MB)")
            else:
                print(f"Upload FAILED: {result.get('error', 'unknown')}")

    elif args.all:
        print("Running full backup cycle...")
        r1 = backup_local_db()
        print(f"  Local: {r1['status']} ({r1.get('size_mb', '?')} MB)")

        r2 = backup_production_db()
        print(f"  Production: {r2['status']} ({r2.get('size_mb', '?')} MB)")

        # Upload local backup to Azure
        if r1["status"] == "success":
            r3 = upload_to_azure(r1["file"])
            print(f"  Azure (local): {r3['status']}")
        # Upload production backup to Azure
        if r2["status"] == "success":
            r4 = upload_to_azure(r2["file"])
            print(f"  Azure (prod): {r4['status']}")

        print("Full backup cycle complete.")

    elif args.restore:
        result = restore_from_backup(args.restore, args.target)
        if args.json:
            print(json.dumps(result, indent=2))
        else:
            print(f"Restore: {result['status']}")
            if result.get("error"):
                print(f"  Error: {result['error']}")

    elif args.restore_latest:
        latest = get_latest_backup("local")
        if not latest:
            print("No local backup found to restore")
            sys.exit(1)
        print(f"Restoring from: {Path(latest).name}")
        result = restore_from_backup(latest, args.target)
        print(f"Restore: {result['status']}")
        if result.get("error"):
            print(f"  Error: {result['error']}")

    elif args.verify:
        result = verify_backup(args.verify)
        if args.json:
            print(json.dumps(result, indent=2))
        else:
            print(f"Verification: {result['status']}")
            print(f"  Size: {result.get('size_mb', '?')} MB")
            print(f"  SHA256: {result.get('sha256', '?')[:32]}...")
            print(f"  Valid SQL: {result.get('valid_sql', '?')}")

    elif args.cleanup:
        result = cleanup_old_backups()
        if args.json:
            print(json.dumps(result, indent=2))
        else:
            print(f"Cleanup: removed {result['removed']} backups, freed {result['freed_mb']} MB")
            print(f"  Kept: {result['kept']} backups")


if __name__ == "__main__":
    main()
