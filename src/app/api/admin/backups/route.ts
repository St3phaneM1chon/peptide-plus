import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { withAdminGuard } from '@/lib/admin-api-guard';

const execAsync = promisify(exec);

const PYTHON = '/opt/homebrew/bin/python3.13';
const MULTI_BACKUP = '/Volumes/AI_Project/AttitudesVIP-iOS/Scripts/aurelia_multi_backup.py';
const SAFETY_GATE = '/Volumes/AI_Project/AttitudesVIP-iOS/Scripts/aurelia_safety_gate.py';

async function runPython(script: string, args: string): Promise<string> {
  try {
    const { stdout } = await execAsync(`${PYTHON} ${script} ${args}`, {
      timeout: 30000,
      env: { ...process.env, PYTHONPATH: '/Volumes/AI_Project/AttitudesVIP-iOS/Scripts' },
    });
    return stdout;
  } catch (error: unknown) {
    const err = error as { stdout?: string; stderr?: string; message?: string };
    return err.stdout || err.stderr || err.message || 'Script execution failed';
  }
}

export const GET = withAdminGuard(async () => {
  try {
    // Run all queries in parallel
    const [statusRaw, verifyRaw, safetyRaw] = await Promise.all([
      runPython(MULTI_BACKUP, '--status --json'),
      runPython(MULTI_BACKUP, '--verify --json'),
      runPython(SAFETY_GATE, '--status'),
    ]);

    // Also get versions for each project
    const [aureliaVersions, peptideDbVersions, peptideCodeVersions, frameworkVersions] = await Promise.all([
      runPython(MULTI_BACKUP, '--list-versions aurelia --json'),
      runPython(MULTI_BACKUP, '--list-versions peptide-plus --json'),
      runPython(MULTI_BACKUP, '--list-versions peptide-code --json'),
      runPython(MULTI_BACKUP, '--list-versions attitudes-framework --json'),
    ]);

    let status = {};
    let verify = {};
    const versions: Record<string, unknown[]> = {};

    try { status = JSON.parse(statusRaw); } catch { status = { error: 'parse_failed', raw: statusRaw.slice(0, 500) }; }
    try { verify = JSON.parse(verifyRaw); } catch { verify = { error: 'parse_failed' }; }
    try { versions['aurelia'] = JSON.parse(aureliaVersions); } catch { versions['aurelia'] = []; }
    try { versions['peptide-db'] = JSON.parse(peptideDbVersions); } catch { versions['peptide-db'] = []; }
    try { versions['peptide-code'] = JSON.parse(peptideCodeVersions); } catch { versions['peptide-code'] = []; }
    try { versions['attitudes-framework'] = JSON.parse(frameworkVersions); } catch { versions['attitudes-framework'] = []; }

    // Parse safety gate text output
    const safety: Record<string, string> = {};
    for (const line of safetyRaw.split('\n')) {
      const match = line.match(/^\s+(RAM|Swap|Disk|Agents|Backup|Blocks|Overall):\s+(.+)$/);
      if (match) {
        safety[match[1].toLowerCase()] = match[2].trim();
      }
    }

    return NextResponse.json({
      status,
      verify,
      versions,
      safety,
      generatedAt: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}, { requiredPermission: 'admin.backups' });
