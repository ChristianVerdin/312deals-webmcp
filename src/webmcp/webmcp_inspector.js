/**
 * 312Deals WebMCP Inspector & Test Harness
 * ==========================================
 * Development utility for testing WebMCP tool registration,
 * execution, schema validation, and Declarative form enhancement
 * without needing an actual AI agent.
 *
 * Usage:
 *   1. Browser console: import and run individual tests
 *   2. Next.js page: /admin/webmcp-inspector
 *   3. CI: Node.js test runner with mocked navigator.modelContext
 *   4. Chrome DevTools MCP: evaluate_script to run tests remotely
 */

// ============================================================
// MOCK navigator.modelContext for testing
// ============================================================

export class MockModelContext {
  constructor(options = {}) {
    this.tools = new Map();
    this.context = null;
    this.callLog = [];
    this.__polyfill = options.simulatePolyfill || false;
  }

  registerTool(toolDef) {
    if (!toolDef.name) throw new Error('Tool must have a name');
    if (!toolDef.inputSchema) throw new Error(`Tool ${toolDef.name} must have an inputSchema`);
    if (!toolDef.handler && !toolDef.execute) {
      throw new Error(`Tool ${toolDef.name} must have a handler or execute function`);
    }
    this.tools.set(toolDef.name, toolDef);
    return true;
  }

  unregisterTool(name) {
    return this.tools.delete(name);
  }

  provideContext(ctx) {
    this.context = ctx;
  }

  clearContext() {
    this.context = null;
  }

  async requestUserInteraction(config) {
    // In test mode, auto-approve
    console.log(`[Mock] requestUserInteraction: ${config.message}`);
    return true;
  }

  async invokeTool(name, params = {}) {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Tool "${name}" not registered`);

    const handler = tool.handler || tool.execute;
    const start = performance.now();
    const result = await handler(params);
    const duration = Math.round(performance.now() - start);

    const logEntry = { tool: name, params, result, duration_ms: duration, timestamp: new Date().toISOString() };
    this.callLog.push(logEntry);
    return logEntry;
  }

  getRegisteredTools() {
    return Array.from(this.tools.values()).map(t => ({
      name: t.name,
      description: t.description,
      parameters: t.inputSchema,
    }));
  }

  getCallLog() { return this.callLog; }
}

// ============================================================
// SCHEMA VALIDATOR
// ============================================================

export function validateToolSchema(tool) {
  const issues = [];

  // Name validation
  if (!tool.name) issues.push('Missing: name');
  if (tool.name && tool.name.length > 64) issues.push('name exceeds 64 chars');
  if (tool.name && !/^[a-z][a-z0-9_]*$/.test(tool.name)) issues.push('name should be lowercase with underscores');

  // Description validation (Agent SEO quality)
  if (!tool.description) {
    issues.push('Missing: description');
  } else {
    if (tool.description.length < 50) issues.push('Description too short (<50 chars). Agents need detail.');
    if (tool.description.length > 500) issues.push('Description very long (>500 chars). May be truncated.');
    const desc = tool.description.toLowerCase();
    if (!/\b(find|search|get|list|show|plan|submit|check)\b/.test(desc)) {
      issues.push('Description lacks action verbs (find, search, get, etc.)');
    }
    if (!/example|e\.g\.|such as|\blike\b/.test(desc) && tool.inputSchema?.properties) {
      issues.push('Consider adding examples in description for better agent discovery');
    }
  }

  // Input schema validation
  if (!tool.inputSchema) {
    issues.push('Missing: inputSchema');
  } else {
    if (tool.inputSchema.type !== 'object') issues.push('inputSchema.type should be "object"');
    if (tool.inputSchema.properties) {
      for (const [propName, propDef] of Object.entries(tool.inputSchema.properties)) {
        if (!propDef.type) issues.push(`Property "${propName}" missing type`);
        if (!propDef.description) issues.push(`Property "${propName}" missing description`);
      }
    }
  }

  // Handler validation
  if (!tool.handler && !tool.execute) issues.push('Missing: handler or execute function');

  // Registration type validation (Dual API)
  if (tool.registrationType && !['imperative', 'both'].includes(tool.registrationType)) {
    issues.push(`Invalid registrationType: "${tool.registrationType}" (must be "imperative" or "both")`);
  }

  return {
    tool_name: tool.name || 'unnamed',
    valid: issues.length === 0,
    issues,
    quality_score: Math.max(0, 100 - issues.length * 15),
  };
}

// ============================================================
// DECLARATIVE FORM VALIDATOR
// ============================================================

/**
 * Validate that Declarative form enhancement was applied correctly.
 * Run after enhanceFormsForWebMCP() to verify attributes are set.
 * ✅ Attribute names confirmed in Chrome Canary 147 (Feb 2026 EPP).
 *
 * @param {string[]} expectedFormIds - Form IDs that should have attributes
 * @returns {Object[]} Validation results per form
 */
export function validateDeclarativeForms(expectedFormIds = []) {
  if (typeof document === 'undefined') return [{ error: 'Not in browser environment' }];

  const results = [];

  for (const formId of expectedFormIds) {
    const form = document.getElementById(formId);
    const result = { formId, found: !!form, issues: [] };

    if (!form) {
      result.issues.push(`Form #${formId} not found in DOM`);
      results.push(result);
      continue;
    }

    // Check form-level attributes
    const toolName = form.getAttribute('toolname');
    const toolDesc = form.getAttribute('tooldescription');
    const autoSubmit = form.getAttribute('toolautosubmit');

    if (!toolName) result.issues.push('Missing toolname attribute');
    if (!toolDesc) result.issues.push('Missing tooldescription attribute');
    if (autoSubmit === null) result.issues.push('Missing toolautosubmit attribute');

    // Check input-level attributes
    const inputs = form.querySelectorAll('[name]');
    let withParamDesc = 0;
    let withoutParamDesc = 0;

    inputs.forEach(input => {
      if (input.getAttribute('toolparamdescription')) withParamDesc++;
      else withoutParamDesc++;
    });

    if (withoutParamDesc > 0) {
      result.issues.push(`${withoutParamDesc} inputs missing toolparamdescription`);
    }

    result.toolName = toolName;
    result.inputsWithDesc = withParamDesc;
    result.inputsWithoutDesc = withoutParamDesc;
    result.valid = result.issues.length === 0;
    results.push(result);
  }

  return results;
}

// ============================================================
// DETECTION SOURCE VALIDATOR
// ============================================================

/**
 * Test and report on WebMCP detection source.
 */
export function validateDetection() {
  if (typeof navigator === 'undefined') {
    return { source: 'unavailable', reason: 'Not in browser environment' };
  }

  const hasModelContext = 'modelContext' in navigator;
  const isPolyfill = hasModelContext && navigator.modelContext?.__polyfill;
  const isNative = hasModelContext && !isPolyfill;
  const chromeVersion = navigator.userAgent.match(/Chrome\/(\d+)/)?.[1];

  return {
    source: isNative ? 'native' : isPolyfill ? 'polyfill' : 'unavailable',
    has_model_context: hasModelContext,
    is_polyfill: !!isPolyfill,
    chrome_version: chromeVersion || 'unknown',
    testing_api: 'modelContextTesting' in navigator,
    recommendation: !hasModelContext
      ? 'Install @mcp-b/global polyfill or use Chrome 146+ with WebMCP flag'
      : isPolyfill
        ? 'Running via polyfill. Native support available in Chrome 146+'
        : 'Native WebMCP detected, optimal performance',
  };
}

// ============================================================
// TEST RUNNER
// ============================================================

export async function runToolTests(tools, apiBaseUrl = '') {
  const results = [];

  for (const tool of tools) {
    const testResult = {
      tool_name: tool.name,
      registration_type: tool.registrationType || 'imperative',
      schema_validation: validateToolSchema(tool),
      execution_tests: [],
    };

    const testCases = generateTestCases(tool);

    for (const testCase of testCases) {
      try {
        const handler = tool.handler || tool.execute;
        const start = performance.now();
        const result = await handler(testCase.params);
        const duration = Math.round(performance.now() - start);

        testResult.execution_tests.push({
          case: testCase.name,
          params: testCase.params,
          passed: !result?.error,
          duration_ms: duration,
          response_size: JSON.stringify(result).length,
        });
      } catch (e) {
        testResult.execution_tests.push({
          case: testCase.name,
          params: testCase.params,
          passed: false,
          error: e.message,
        });
      }
    }

    results.push(testResult);
  }

  return results;
}

export function generateTestCases(tool) {
  const required = tool.inputSchema?.required || [];
  const cases = required.length === 0 ? [{ name: 'empty_params', params: {} }] : [];
  const props = tool.inputSchema?.properties || {};

  const fullParams = {};
  for (const [name, def] of Object.entries(props)) {
    if (def.type === 'string') {
      if (def.enum) fullParams[name] = def.enum[0];
      else if (name === 'neighborhood') fullParams[name] = 'West Loop';
      else if (name === 'address') fullParams[name] = '333 N Michigan Ave';
      else if (name === 'query') fullParams[name] = 'happy hour';
      else if (name === 'venue_name') fullParams[name] = 'Big Star';
      else if (name === 'deal_description') fullParams[name] = '$5 tacos every Tuesday 4-6pm';
      else fullParams[name] = 'test';
    } else if (def.type === 'number') {
      if (name === 'lat') fullParams[name] = 41.8827;
      else if (name === 'lng') fullParams[name] = -87.6233;
      else fullParams[name] = def.default || 5;
    } else if (def.type === 'integer') fullParams[name] = def.default || 10;
    else if (def.type === 'boolean') fullParams[name] = def.default !== undefined ? def.default : true;
  }
  cases.push({ name: 'all_params', params: fullParams });

  if (required.length > 0) {
    const reqOnly = {};
    for (const name of required) reqOnly[name] = fullParams[name] || 'test';
    cases.push({ name: 'required_only', params: reqOnly });
  }

  return cases;
}

// ============================================================
// REPORT GENERATOR
// ============================================================

export function generateReport(testResults) {
  const totalTools = testResults.length;
  const validSchemas = testResults.filter(r => r.schema_validation.valid).length;
  const totalTests = testResults.reduce((sum, r) => sum + r.execution_tests.length, 0);
  const passingTests = testResults.reduce((sum, r) => sum + r.execution_tests.filter(t => t.passed).length, 0);
  const imperativeOnly = testResults.filter(r => r.registration_type === 'imperative').length;
  const dualApi = testResults.filter(r => r.registration_type === 'both').length;

  let report = `\n${'='.repeat(60)}\n`;
  report += `  312Deals WebMCP Tool Inspection Report\n`;
  report += `  ${new Date().toISOString()}\n`;
  report += `${'='.repeat(60)}\n\n`;
  report += `  Tools: ${totalTools} | Valid: ${validSchemas}/${totalTools}\n`;
  report += `  Tests: ${passingTests}/${totalTests} passing\n`;
  report += `  Dual API (Declarative+Imperative): ${dualApi} | Imperative only: ${imperativeOnly}\n\n`;

  for (const result of testResults) {
    const sv = result.schema_validation;
    const regType = result.registration_type === 'both' ? '📋+⚡' : '⚡';
    report += `  ${sv.valid ? '✓' : '✗'} ${result.tool_name} ${regType} (quality: ${sv.quality_score}/100)\n`;
    for (const issue of sv.issues) report += `    ⚠ ${issue}\n`;
    for (const test of result.execution_tests) {
      report += `    ${test.passed ? '✓' : '✗'} ${test.case}`;
      if (test.duration_ms !== undefined) report += ` (${test.duration_ms}ms)`;
      if (test.error) report += `, ${test.error}`;
      report += '\n';
    }
    report += '\n';
  }

  return report;
}

export default { MockModelContext, validateToolSchema, validateDeclarativeForms, validateDetection, runToolTests, generateReport };
