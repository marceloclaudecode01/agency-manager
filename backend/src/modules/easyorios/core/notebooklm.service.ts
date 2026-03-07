import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const TIMEOUT_MS = 120_000; // 2 min default
const LONG_TIMEOUT_MS = 300_000; // 5 min for generation

interface NotebookInfo {
  id: string;
  title: string;
  [key: string]: any;
}

interface ArtifactInfo {
  id: string;
  type: string;
  status: string;
  [key: string]: any;
}

export interface CLIResult {
  success: boolean;
  data?: any;
  error?: string;
}

async function runCLI(command: string, timeout = TIMEOUT_MS): Promise<CLIResult> {
  try {
    const { stdout, stderr } = await execAsync(`notebooklm ${command}`, { timeout });
    // Try to parse JSON output
    try {
      const data = JSON.parse(stdout.trim());
      return { success: true, data };
    } catch {
      // Non-JSON output
      return { success: true, data: stdout.trim() };
    }
  } catch (err: any) {
    const msg = err.stderr?.trim() || err.message || 'Unknown CLI error';
    return { success: false, error: msg };
  }
}

export async function createNotebook(title: string): Promise<CLIResult> {
  return runCLI(`create "${title}" --json`);
}

export async function useNotebook(id: string): Promise<CLIResult> {
  return runCLI(`use ${id}`);
}

export async function addSource(content: string, type?: string): Promise<CLIResult> {
  const typeFlag = type ? ` --type ${type}` : '';
  return runCLI(`source add "${content}"${typeFlag} --json`);
}

export async function addResearch(query: string, mode = 'deep'): Promise<CLIResult> {
  return runCLI(`source add-research "${query}" --mode ${mode} --no-wait`);
}

export async function generateArtifact(
  type: string,
  description: string,
  sources?: string[],
): Promise<CLIResult> {
  const srcFlag = sources?.length ? ` --sources ${sources.join(',')}` : '';
  return runCLI(`generate ${type} "${description}"${srcFlag} --wait --json`, LONG_TIMEOUT_MS);
}

export async function downloadArtifact(type: string, id: string): Promise<CLIResult> {
  return runCLI(`download ${type} ${id}`);
}

export async function askNotebook(question: string, notebookId?: string): Promise<CLIResult> {
  const nbFlag = notebookId ? ` --notebook ${notebookId}` : '';
  return runCLI(`ask "${question}"${nbFlag} --json`);
}

export async function listNotebooks(): Promise<CLIResult> {
  return runCLI('list --json');
}

export async function listArtifacts(): Promise<CLIResult> {
  return runCLI('artifact list --json');
}

export async function getArtifactSuggestions(): Promise<CLIResult> {
  return runCLI('artifact suggestions --json');
}

export async function waitForArtifact(id: string): Promise<CLIResult> {
  return runCLI(`artifact wait ${id} --json`, LONG_TIMEOUT_MS);
}
