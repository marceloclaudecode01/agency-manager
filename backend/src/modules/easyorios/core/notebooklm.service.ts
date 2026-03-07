import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const execAsync = promisify(exec);

const TIMEOUT_MS = 120_000;
const LONG_TIMEOUT_MS = 300_000;

const STORAGE_PATH = process.env.NOTEBOOKLM_STORAGE_PATH || '';

export interface CLIResult {
  success: boolean;
  data?: any;
  error?: string;
}

function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * Writes a temp .py file and executes it. Avoids shell quoting issues.
 */
async function runPy(innerCode: string, timeout = TIMEOUT_MS): Promise<CLIResult> {
  const storageLine = STORAGE_PATH
    ? `Path('${STORAGE_PATH.replace(/\\/g, '/')}')`
    : 'None';

  const script = `
import asyncio, json, sys
from notebooklm import NotebookLMClient
from notebooklm.auth import AuthTokens
from pathlib import Path

async def main():
    auth = await AuthTokens.from_storage(${storageLine})
    async with NotebookLMClient(auth) as client:
        notebooks = await client.notebooks.list()
        if notebooks:
            nb_id = notebooks[0].id
        else:
            nb = await client.notebooks.create(title='Easyorios Default')
            nb_id = nb.id
${innerCode}

try:
    asyncio.run(main())
except Exception as e:
    print(json.dumps({"error": str(e)}))
    sys.exit(1)
`;

  const tmpFile = join(tmpdir(), `nlm_${Date.now()}.py`);
  try {
    writeFileSync(tmpFile, script, 'utf-8');
    const { stdout } = await execAsync(`python3 ${tmpFile}`, { timeout });
    try {
      const data = JSON.parse(stdout.trim());
      if (data.error) return { success: false, error: data.error };
      return { success: true, data };
    } catch {
      return { success: true, data: stdout.trim() };
    }
  } catch (err: any) {
    const msg = err.stderr?.trim()?.split('\n').pop() || err.message || 'Unknown error';
    return { success: false, error: msg };
  } finally {
    try { unlinkSync(tmpFile); } catch {}
  }
}

export async function createNotebook(title: string): Promise<CLIResult> {
  return runPy(`
        nb = await client.notebooks.create(title='${esc(title)}')
        print(json.dumps({"id": nb.id, "title": nb.title}))`);
}

export async function addSource(content: string): Promise<CLIResult> {
  return runPy(`
        content = '${esc(content)}'
        if content.startswith('http'):
            src = await client.sources.add_url(nb_id, content)
        else:
            src = await client.sources.add_text(nb_id, title='Source', content=content)
        print(json.dumps({"id": src.id, "title": getattr(src, "title", ""), "status": str(getattr(src, "status", ""))}))`);
}

export async function addResearch(query: string, mode = 'deep'): Promise<CLIResult> {
  return runPy(`
        result = await client.research.start(nb_id, '${esc(query)}', mode='${esc(mode)}')
        print(json.dumps({"status": "started", "query": "${esc(query)}", "data": str(result)}))`);
}

export async function generateArtifact(type: string, description: string): Promise<CLIResult> {
  const methods: Record<string, string> = {
    'audio':        `await client.artifacts.generate_audio(nb_id, language='pt', instructions='${esc(description)}')`,
    'report':       `await client.artifacts.generate_report(nb_id, language='pt', custom_prompt='${esc(description)}')`,
    'briefing-doc': `await client.artifacts.generate_report(nb_id, language='pt', custom_prompt='${esc(description)}')`,
    'video':        `await client.artifacts.generate_video(nb_id, language='pt', instructions='${esc(description)}')`,
    'slide-deck':   `await client.artifacts.generate_slide_deck(nb_id, language='pt', instructions='${esc(description)}')`,
    'quiz':         `await client.artifacts.generate_quiz(nb_id, instructions='${esc(description)}')`,
    'flashcards':   `await client.artifacts.generate_flashcards(nb_id, instructions='${esc(description)}')`,
    'mind-map':     `await client.artifacts.generate_mind_map(nb_id)`,
    'infographic':  `await client.artifacts.generate_infographic(nb_id, language='pt', instructions='${esc(description)}')`,
    'data-table':   `await client.artifacts.generate_data_table(nb_id, language='pt', instructions='${esc(description)}')`,
    'study-guide':  `await client.artifacts.generate_study_guide(nb_id, language='pt', extra_instructions='${esc(description)}')`,
  };

  const call = methods[type] || methods['report'];

  return runPy(`
        result = ${call}
        print(json.dumps({"type": "${esc(type)}", "status": str(getattr(result, "status", "started")), "task_id": getattr(result, "task_id", "")}))`
  , LONG_TIMEOUT_MS);
}

export async function askNotebook(question: string): Promise<CLIResult> {
  return runPy(`
        result = await client.chat.ask(nb_id, '${esc(question)}')
        print(json.dumps({"answer": result.text if hasattr(result, "text") else str(result)}))`);
}

export async function listNotebooks(): Promise<CLIResult> {
  return runPy(`
        nbs = await client.notebooks.list()
        print(json.dumps([{"id": nb.id, "title": nb.title} for nb in nbs]))`);
}

export async function listArtifacts(): Promise<CLIResult> {
  return runPy(`
        arts = await client.artifacts.list(nb_id)
        print(json.dumps([{"id": getattr(a, "id", ""), "type": str(getattr(a, "type", "")), "status": str(getattr(a, "status", ""))} for a in arts]))`);
}

export async function getArtifactSuggestions(): Promise<CLIResult> {
  return runPy(`
        sug = await client.artifacts.suggest_reports(nb_id)
        print(json.dumps([{"type": str(getattr(s, "type", "")), "description": str(getattr(s, "description", ""))} for s in sug]))`);
}

export async function downloadArtifact(type: string, id: string): Promise<CLIResult> {
  return runPy(`
        result = await client.artifacts.get(nb_id, '${esc(id)}')
        print(json.dumps({"id": "${esc(id)}", "type": "${esc(type)}", "status": str(getattr(result, "status", ""))}))`);
}

export async function useNotebook(id: string): Promise<CLIResult> {
  return runPy(`
        nbs = await client.notebooks.list()
        found = [n for n in nbs if n.id == '${esc(id)}']
        if found:
            print(json.dumps({"id": "${esc(id)}", "title": found[0].title, "active": True}))
        else:
            print(json.dumps({"error": "Notebook nao encontrado"}))`);
}

export async function waitForArtifact(id: string): Promise<CLIResult> {
  return runPy(`
        result = await client.artifacts.wait_for_completion(nb_id, '${esc(id)}')
        print(json.dumps({"id": "${esc(id)}", "status": str(getattr(result, "status", "done"))}))`
  , LONG_TIMEOUT_MS);
}
