import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const TIMEOUT_MS = 120_000;
const LONG_TIMEOUT_MS = 300_000;

// Storage state path — in Docker it's copied to /app/.notebooklm/
const STORAGE_PATH = process.env.NOTEBOOKLM_STORAGE_PATH || '';
const STORAGE_ARG = STORAGE_PATH ? `"${STORAGE_PATH}"` : 'None';

export interface CLIResult {
  success: boolean;
  data?: any;
  error?: string;
}

function pyScript(code: string): string {
  // Wraps Python code that uses the notebooklm async API
  return `python3 -c "
import asyncio, json, sys
from notebooklm import NotebookLMClient
from notebooklm.auth import AuthTokens
from pathlib import Path

async def main():
    storage = ${STORAGE_ARG}
    auth = await AuthTokens.from_storage(Path(storage) if storage else None)
    async with NotebookLMClient(auth) as client:
${code}

try:
    asyncio.run(main())
except Exception as e:
    print(json.dumps({'error': str(e)}))
    sys.exit(1)
"`;
}

async function runPy(code: string, timeout = TIMEOUT_MS): Promise<CLIResult> {
  try {
    const { stdout } = await execAsync(pyScript(code), { timeout });
    try {
      const data = JSON.parse(stdout.trim());
      if (data.error) return { success: false, error: data.error };
      return { success: true, data };
    } catch {
      return { success: true, data: stdout.trim() };
    }
  } catch (err: any) {
    const msg = err.stderr?.trim() || err.message || 'Unknown error';
    return { success: false, error: msg };
  }
}

export async function createNotebook(title: string): Promise<CLIResult> {
  const safe = title.replace(/'/g, "\\'");
  return runPy(`
        nb = await client.notebooks.create(title='${safe}')
        print(json.dumps({'id': nb.id, 'title': nb.title}))`);
}

export async function addSource(content: string, _type?: string): Promise<CLIResult> {
  const safe = content.replace(/'/g, "\\'");
  return runPy(`
        src = await client.sources.add(url='${safe}')
        print(json.dumps({'id': src.id, 'title': getattr(src, 'title', ''), 'status': str(getattr(src, 'status', ''))}))`);
}

export async function addResearch(query: string, _mode = 'deep'): Promise<CLIResult> {
  const safe = query.replace(/'/g, "\\'");
  return runPy(`
        result = await client.research.start('${safe}')
        print(json.dumps({'status': 'started', 'query': '${safe}', 'data': str(result)}))`);
}

export async function generateArtifact(
  type: string,
  description: string,
  _sources?: string[],
): Promise<CLIResult> {
  const safeDesc = description.replace(/'/g, "\\'");
  const safeType = type.replace(/'/g, "\\'");
  return runPy(`
        from notebooklm.types import ArtifactType
        atype = ArtifactType('${safeType}')
        artifact = await client.artifacts.generate(atype, instructions='${safeDesc}')
        print(json.dumps({'id': getattr(artifact, 'id', ''), 'type': '${safeType}', 'status': str(getattr(artifact, 'status', 'generated'))}))`
  , LONG_TIMEOUT_MS);
}

export async function askNotebook(question: string, notebookId?: string): Promise<CLIResult> {
  const safeQ = question.replace(/'/g, "\\'");
  const nbLine = notebookId ? `await client.notebooks.use('${notebookId}')\n        ` : '';
  return runPy(`
        ${nbLine}result = await client.chat.send('${safeQ}')
        print(json.dumps({'answer': result.text if hasattr(result, 'text') else str(result)}))`);
}

export async function listNotebooks(): Promise<CLIResult> {
  return runPy(`
        notebooks = await client.notebooks.list()
        print(json.dumps([{'id': nb.id, 'title': nb.title} for nb in notebooks]))`);
}

export async function listArtifacts(): Promise<CLIResult> {
  return runPy(`
        artifacts = await client.artifacts.list()
        print(json.dumps([{'id': getattr(a, 'id', ''), 'type': str(getattr(a, 'type', '')), 'status': str(getattr(a, 'status', ''))} for a in artifacts]))`);
}

export async function getArtifactSuggestions(): Promise<CLIResult> {
  return runPy(`
        suggestions = await client.artifacts.suggestions()
        print(json.dumps([{'type': str(getattr(s, 'type', '')), 'description': str(getattr(s, 'description', ''))} for s in suggestions]))`);
}

export async function downloadArtifact(type: string, id: string): Promise<CLIResult> {
  const safeType = type.replace(/'/g, "\\'");
  const safeId = id.replace(/'/g, "\\'");
  return runPy(`
        data = await client.artifacts.download('${safeId}')
        print(json.dumps({'id': '${safeId}', 'type': '${safeType}', 'downloaded': True}))`);
}

export async function useNotebook(id: string): Promise<CLIResult> {
  const safeId = id.replace(/'/g, "\\'");
  return runPy(`
        await client.notebooks.use('${safeId}')
        print(json.dumps({'id': '${safeId}', 'active': True}))`);
}

export async function waitForArtifact(id: string): Promise<CLIResult> {
  const safeId = id.replace(/'/g, "\\'");
  return runPy(`
        result = await client.artifacts.wait('${safeId}')
        print(json.dumps({'id': '${safeId}', 'status': str(getattr(result, 'status', 'done'))}))`
  , LONG_TIMEOUT_MS);
}
