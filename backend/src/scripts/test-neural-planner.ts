/**
 * Neural Planner Test — Tests the new autonomous brain capability
 *
 * Tests:
 * 1. planActions() — LLM generates action plan from user message
 * 2. executePlan() — Sequential execution with param resolution
 * 3. Suggestion mode — canExecute=false for unknown capabilities
 * 4. Data capabilities — DB queries (list_recent_posts, get_post_quality, count_by_status)
 *
 * Usage: npx tsx src/scripts/test-neural-planner.ts
 */

import prisma from '../config/database';

const DIVIDER = '═'.repeat(60);

function log(step: string, msg: string) {
  console.log(`\n[${step}] ${msg}`);
}

// ── Test 1: Data capabilities (no LLM needed) ──
async function testDataCapabilities(): Promise<boolean> {
  log('TEST 1', 'Testing data capabilities (DB queries)...');

  try {
    const { executeNeuralAction } = await import('../modules/easyorios/core/neural-planner');

    // Test list_recent_posts directly via the capability
    log('TEST 1a', 'count_by_status...');
    const countResult = await executeNeuralAction('quantos posts por status', 'test-user');
    if (countResult) {
      console.log(`  ✅ count_by_status: ${countResult.message}`);
      console.log(`  Data: ${JSON.stringify(countResult.data?.finalResult || countResult.data).substring(0, 200)}`);
    } else {
      console.log('  ⚠️ Neural planner returned null (LLM may not have matched)');
    }

    log('TEST 1b', 'get_post_quality...');
    const qualityResult = await executeNeuralAction('qual a qualidade media dos posts', 'test-user');
    if (qualityResult) {
      console.log(`  ✅ get_post_quality: ${qualityResult.message}`);
      console.log(`  Data: ${JSON.stringify(qualityResult.data?.finalResult || qualityResult.data).substring(0, 200)}`);
    } else {
      console.log('  ⚠️ Neural planner returned null');
    }

    return true;
  } catch (e: any) {
    log('TEST 1', `❌ Error: ${e.message}`);
    return false;
  }
}

// ── Test 2: Complex plan (pipeline test) ──
async function testPipelinePlan(): Promise<boolean> {
  log('TEST 2', 'Testing complex plan: "testa o pipeline de conteudo"...');

  try {
    const { executeNeuralAction } = await import('../modules/easyorios/core/neural-planner');

    const result = await executeNeuralAction('testa o pipeline de conteudo', 'test-user');
    if (result) {
      console.log(`  ✅ Command: ${result.command}`);
      console.log(`  Success: ${result.success}`);
      console.log(`  Message: ${result.message}`);
      if (result.data?.steps) {
        for (const step of result.data.steps) {
          console.log(`    ${step}`);
        }
      }
      return result.success;
    } else {
      console.log('  ⚠️ Neural planner returned null');
      return false;
    }
  } catch (e: any) {
    log('TEST 2', `❌ Error: ${e.message}`);
    return false;
  }
}

// ── Test 3: Suggestion mode ──
async function testSuggestionMode(): Promise<boolean> {
  log('TEST 3', 'Testing suggestion mode: "integra com slack"...');

  try {
    const { executeNeuralAction } = await import('../modules/easyorios/core/neural-planner');

    const result = await executeNeuralAction('integra com slack', 'test-user');
    if (result) {
      console.log(`  ✅ Command: ${result.command}`);
      console.log(`  Message: ${result.message}`);
      if (result.data?.title) {
        console.log(`  Suggestion: ${result.data.title}`);
        console.log(`  Description: ${result.data.description}`);
        console.log(`  Requirements: ${result.data.requirements?.join(', ')}`);
        console.log(`  Effort: ${result.data.effort}`);
      }
      return result.command === 'neural_suggestion';
    } else {
      console.log('  ⚠️ Neural planner returned null');
      return false;
    }
  } catch (e: any) {
    log('TEST 3', `❌ Error: ${e.message}`);
    return false;
  }
}

// ── Test 4: Simple query ──
async function testSimpleQuery(): Promise<boolean> {
  log('TEST 4', 'Testing simple query: "como estao os posts de hoje"...');

  try {
    const { executeNeuralAction } = await import('../modules/easyorios/core/neural-planner');

    const result = await executeNeuralAction('como estao os posts de hoje', 'test-user');
    if (result) {
      console.log(`  ✅ Command: ${result.command}`);
      console.log(`  Success: ${result.success}`);
      console.log(`  Steps: ${result.data?.steps?.length || 0}`);
      console.log(`  Message: ${result.message.substring(0, 300)}`);
      return result.success;
    } else {
      console.log('  ⚠️ Neural planner returned null');
      return false;
    }
  } catch (e: any) {
    log('TEST 4', `❌ Error: ${e.message}`);
    return false;
  }
}

async function main() {
  console.log(DIVIDER);
  console.log('  NEURAL PLANNER TEST');
  console.log(DIVIDER);

  const results: Record<string, boolean> = {};

  // Test 1: Data capabilities (fastest, no content generation)
  results['Data Capabilities (DB queries)'] = await testDataCapabilities();

  // Test 2: Complex pipeline plan
  results['Pipeline Plan (multi-step)'] = await testPipelinePlan();

  // Test 3: Suggestion mode
  results['Suggestion Mode (canExecute=false)'] = await testSuggestionMode();

  // Test 4: Simple query
  results['Simple Query (posts hoje)'] = await testSimpleQuery();

  // Summary
  console.log(`\n${DIVIDER}`);
  console.log('  RESULTS');
  console.log(DIVIDER);
  for (const [name, passed] of Object.entries(results)) {
    console.log(`  ${passed ? '✅' : '❌'} ${name}`);
  }
  const allPassed = Object.values(results).every(v => v);
  console.log(`\n  ${allPassed ? '🎉 ALL TESTS PASSED' : '⚠️ SOME TESTS FAILED'}`);
  console.log(DIVIDER);

  await prisma.$disconnect();
  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
