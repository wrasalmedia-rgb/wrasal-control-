#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import yaml from 'js-yaml';

function parseArgs(argv) {
  const args = { root: process.cwd(), report: null };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--root') {
      args.root = argv[index + 1];
      index += 1;
    } else if (arg === '--report') {
      args.report = argv[index + 1];
      index += 1;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return {
    root: path.resolve(args.root),
    report: args.report ? path.resolve(args.report) : null,
  };
}

function printHelp() {
  console.log(`Usage: node scripts/validate-control-plane.mjs [--root PATH] [--report PATH]\n\nValidates WRASAL control-plane YAML/JSON records using repository-pinned dependencies.`);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sorted(value) {
  return [...value].sort();
}

function createValidator(root) {
  const checks = [];
  const errors = [];

  function recordCheck(name, file, result, detail = null) {
    checks.push({ name, file, result, ...(detail ? { detail } : {}) });
  }

  function fail(name, file, message) {
    errors.push({ name, file, message });
    recordCheck(name, file, 'fail', message);
  }

  function pass(name, file, detail = null) {
    recordCheck(name, file, 'pass', detail);
  }

  function assertCondition(condition, name, file, message) {
    if (!condition) {
      fail(name, file, message);
      return false;
    }

    pass(name, file);
    return true;
  }

  function readRequiredFile(relativePath) {
    const fullPath = path.join(root, relativePath);

    if (!fs.existsSync(fullPath)) {
      fail('file.exists', relativePath, 'required file is missing');
      return null;
    }

    pass('file.exists', relativePath);
    return fs.readFileSync(fullPath, 'utf8');
  }

  function parseJson(relativePath) {
    const text = readRequiredFile(relativePath);
    if (text === null) return null;

    try {
      const data = JSON.parse(text);
      pass('json.parse', relativePath);
      return data;
    } catch (error) {
      fail('json.parse', relativePath, error.message);
      return null;
    }
  }

  function parseYaml(relativePath) {
    const text = readRequiredFile(relativePath);
    if (text === null) return null;

    try {
      const data = yaml.load(text, { filename: relativePath, schema: yaml.FAILSAFE_SCHEMA });
      pass('yaml.parse', relativePath);
      return data;
    } catch (error) {
      fail('yaml.parse', relativePath, error.message);
      return null;
    }
  }

  function validateAllowedKeys(object, allowedKeys, file, subject) {
    const keys = Object.keys(object);
    const unexpected = keys.filter((key) => !allowedKeys.includes(key));
    return assertCondition(
      unexpected.length === 0,
      `${subject}.allowed_keys`,
      file,
      `unexpected keys: ${unexpected.join(', ')}`,
    );
  }

  function validateProjects() {
    const file = 'projects.yml';
    const projects = parseYaml(file);
    if (!isPlainObject(projects)) {
      fail('projects.schema', file, 'projects.yml must be a mapping of project identifiers to project facts');
      return;
    }
    pass('projects.schema', file);

    const allowedProjectKeys = ['state', 'objective', 'parent', 'organization', 'repo'];
    const projectIds = Object.keys(projects);
    assertCondition(projectIds.length > 0, 'projects.non_empty', file, 'at least one project must be recorded');

    for (const projectId of projectIds) {
      const project = projects[projectId];
      const subject = `projects.${projectId}`;
      assertCondition(/^[a-z][a-z0-9_-]*$/.test(projectId), `${subject}.id`, file, 'project identifier must be lowercase control-plane id text');

      if (!isPlainObject(project)) {
        fail(`${subject}.schema`, file, 'project facts must be a mapping');
        continue;
      }
      pass(`${subject}.schema`, file);
      validateAllowedKeys(project, allowedProjectKeys, file, subject);
      assertCondition(typeof project.state === 'string' && project.state.length > 0, `${subject}.state`, file, 'project state must be a non-empty string');
      assertCondition(typeof project.repo === 'string' && project.repo.length > 0, `${subject}.repo`, file, 'project repo must be a non-empty string');

      for (const optionalField of ['objective', 'parent', 'organization']) {
        if (Object.hasOwn(project, optionalField)) {
          assertCondition(
            typeof project[optionalField] === 'string' && project[optionalField].length > 0,
            `${subject}.${optionalField}`,
            file,
            `${optionalField} must be a non-empty string when present`,
          );
        }
      }
    }
  }

  function validateCollectionFile(file, topLevelKey) {
    const data = parseYaml(file);
    if (!isPlainObject(data)) {
      fail(`${topLevelKey}.schema`, file, `${file} must be a mapping with ${topLevelKey}`);
      return;
    }
    pass(`${topLevelKey}.schema`, file);
    validateAllowedKeys(data, [topLevelKey], file, topLevelKey);
    assertCondition(Array.isArray(data[topLevelKey]), `${topLevelKey}.array`, file, `${topLevelKey} must be an array`);
  }

  function validateStatusVocabulary() {
    const file = 'work_orders/status-vocabulary.json';
    const vocabulary = parseJson(file);
    if (!isPlainObject(vocabulary)) {
      fail('status_vocabulary.schema', file, 'status vocabulary must be a JSON object');
      return null;
    }
    pass('status_vocabulary.schema', file);

    validateAllowedKeys(vocabulary, ['vocabulary_id', 'authority', 'purpose', 'fields'], file, 'status_vocabulary');
    assertCondition(typeof vocabulary.vocabulary_id === 'string' && vocabulary.vocabulary_id.length > 0, 'status_vocabulary.vocabulary_id', file, 'vocabulary_id must be a non-empty string');
    assertCondition(typeof vocabulary.authority === 'string' && vocabulary.authority.length > 0, 'status_vocabulary.authority', file, 'authority must be a non-empty string');
    assertCondition(typeof vocabulary.purpose === 'string' && vocabulary.purpose.length > 0, 'status_vocabulary.purpose', file, 'purpose must be a non-empty string');

    if (!isPlainObject(vocabulary.fields)) {
      fail('status_vocabulary.fields', file, 'fields must be a mapping');
      return null;
    }
    pass('status_vocabulary.fields', file);

    const requiredFields = ['execution_status', 'implementation_result', 'verification_result', 'canonical_acceptance'];
    const fieldNames = Object.keys(vocabulary.fields);
    const missing = requiredFields.filter((field) => !fieldNames.includes(field));
    const unexpected = fieldNames.filter((field) => !requiredFields.includes(field));
    assertCondition(missing.length === 0, 'status_vocabulary.required_fields', file, `missing fields: ${missing.join(', ')}`);
    assertCondition(unexpected.length === 0, 'status_vocabulary.no_extra_fields', file, `unexpected fields: ${unexpected.join(', ')}`);

    for (const field of requiredFields) {
      const fieldRecord = vocabulary.fields[field];
      if (!isPlainObject(fieldRecord)) {
        fail(`status_vocabulary.${field}.schema`, file, 'field vocabulary must be a mapping');
        continue;
      }
      pass(`status_vocabulary.${field}.schema`, file);
      validateAllowedKeys(fieldRecord, ['allowed', 'meaning'], file, `status_vocabulary.${field}`);
      assertCondition(Array.isArray(fieldRecord.allowed) && fieldRecord.allowed.length > 0, `status_vocabulary.${field}.allowed`, file, 'allowed must be a non-empty array');
      if (Array.isArray(fieldRecord.allowed)) {
        for (const value of fieldRecord.allowed) {
          assertCondition(typeof value === 'string' && value.length > 0, `status_vocabulary.${field}.allowed.value`, file, 'allowed values must be non-empty strings');
        }
      }
      assertCondition(typeof fieldRecord.meaning === 'string' && fieldRecord.meaning.length > 0, `status_vocabulary.${field}.meaning`, file, 'meaning must be a non-empty string');
    }

    return vocabulary;
  }

  function validateWorkOrders(vocabulary) {
    const workOrdersDir = path.join(root, 'work_orders');
    if (!fs.existsSync(workOrdersDir) || !fs.statSync(workOrdersDir).isDirectory()) {
      fail('work_orders.directory', 'work_orders', 'work_orders directory is missing');
      return;
    }
    pass('work_orders.directory', 'work_orders');

    const workOrderFiles = fs
      .readdirSync(workOrdersDir)
      .filter((file) => /^WRASAL-\d{4}\.json$/.test(file))
      .sort();

    assertCondition(workOrderFiles.length > 0, 'work_orders.non_empty', 'work_orders', 'at least one work-order record must exist');

    for (const fileName of workOrderFiles) {
      validateWorkOrder(path.join('work_orders', fileName), vocabulary);
    }
  }

  function validateWorkOrder(file, vocabulary) {
    const record = parseJson(file);
    if (!isPlainObject(record)) {
      fail('work_order.schema', file, 'work-order record must be a JSON object');
      return;
    }
    pass('work_order.schema', file);

    const requiredKeys = [
      'work_order_id',
      'project',
      'record_authority',
      'recorded_on',
      'recorded_by',
      'objective',
      'success_condition',
      'execution_status',
      'implementation_result',
      'verification_result',
      'canonical_acceptance',
      'references',
      'evidence',
      'canonical_state_impact',
      'next_candidate',
    ];
    validateAllowedKeys(record, requiredKeys, file, 'work_order');

    for (const key of requiredKeys) {
      assertCondition(Object.hasOwn(record, key), `work_order.${key}.present`, file, `${key} is required`);
    }

    const expectedId = path.basename(file, '.json');
    assertCondition(record.work_order_id === expectedId, 'work_order.id.matches_filename', file, `work_order_id must match filename ${expectedId}`);

    for (const key of ['work_order_id', 'project', 'record_authority', 'recorded_on', 'recorded_by', 'objective', 'success_condition', 'next_candidate']) {
      assertCondition(typeof record[key] === 'string' && record[key].length > 0, `work_order.${key}`, file, `${key} must be a non-empty string`);
    }

    assertCondition(/^\d{4}-\d{2}-\d{2}$/.test(record.recorded_on), 'work_order.recorded_on.date', file, 'recorded_on must be YYYY-MM-DD');

    for (const field of ['execution_status', 'implementation_result', 'verification_result', 'canonical_acceptance']) {
      const allowed = vocabulary?.fields?.[field]?.allowed ?? [];
      assertCondition(allowed.includes(record[field]), `work_order.${field}.vocabulary`, file, `${field}=${JSON.stringify(record[field])} is not in allowed vocabulary: ${allowed.join(', ')}`);
    }

    if (!isPlainObject(record.references)) {
      fail('work_order.references.schema', file, 'references must be a mapping');
    } else {
      pass('work_order.references.schema', file);
      for (const [key, value] of Object.entries(record.references)) {
        assertCondition(value === null || typeof value === 'string', `work_order.references.${key}`, file, 'reference values must be strings or null');
      }
    }

    if (!Array.isArray(record.evidence) || record.evidence.length === 0) {
      fail('work_order.evidence.schema', file, 'evidence must be a non-empty array');
    } else {
      pass('work_order.evidence.schema', file);
      record.evidence.forEach((evidenceEntry, index) => validateEvidenceEntry(evidenceEntry, file, index, vocabulary));
    }

    if (!isPlainObject(record.canonical_state_impact)) {
      fail('work_order.canonical_state_impact.schema', file, 'canonical_state_impact must be a mapping');
    } else {
      pass('work_order.canonical_state_impact.schema', file);
    }
  }

  function validateEvidenceEntry(evidenceEntry, file, index, vocabulary) {
    const subject = `work_order.evidence.${index}`;
    if (!isPlainObject(evidenceEntry)) {
      fail(`${subject}.schema`, file, 'evidence entry must be a mapping');
      return;
    }
    pass(`${subject}.schema`, file);

    const requiredEvidenceKeys = ['id', 'type', 'attribution', 'source', 'observed_result', 'result'];
    const allowedEvidenceKeys = [...requiredEvidenceKeys, 'reference'];
    validateAllowedKeys(evidenceEntry, allowedEvidenceKeys, file, subject);

    for (const key of requiredEvidenceKeys) {
      assertCondition(typeof evidenceEntry[key] === 'string' && evidenceEntry[key].length > 0, `${subject}.${key}`, file, `${key} must be a non-empty string`);
    }

    if (Object.hasOwn(evidenceEntry, 'reference')) {
      assertCondition(evidenceEntry.reference === null || typeof evidenceEntry.reference === 'string', `${subject}.reference`, file, 'reference must be a string or null when present');
    }

    const allowedResults = vocabulary?.fields?.implementation_result?.allowed ?? [];
    assertCondition(allowedResults.includes(evidenceEntry.result), `${subject}.result.vocabulary`, file, `evidence result=${JSON.stringify(evidenceEntry.result)} is not in allowed result vocabulary: ${allowedResults.join(', ')}`);
  }

  function buildReport() {
    const failedChecks = checks.filter((check) => check.result === 'fail').length;
    return {
      validator: {
        name: 'wrasal-control-plane-validator',
        repository_pinned: true,
        dependency_manifest: 'package.json',
        dependency_lock: 'package-lock.json',
      },
      result: errors.length === 0 ? 'pass' : 'fail',
      summary: {
        checks: checks.length,
        passed: checks.length - failedChecks,
        failed: failedChecks,
      },
      checked_files: sorted([...new Set(checks.map((check) => check.file))]),
      checks,
      errors,
    };
  }

  return {
    validate() {
      validateProjects();
      validateCollectionFile('priorities.yml', 'priorities');
      validateCollectionFile('dependencies.yml', 'dependencies');
      const vocabulary = validateStatusVocabulary();
      validateWorkOrders(vocabulary);
      return buildReport();
    },
  };
}

function writeReport(reportPath, report) {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

try {
  const { root, report: reportPath } = parseArgs(process.argv.slice(2));
  const report = createValidator(root).validate();

  if (reportPath) {
    writeReport(reportPath, report);
  }

  if (report.result === 'pass') {
    console.log(`PASS control-plane validation (${report.summary.checks} checks)`);
    if (reportPath) console.log(`Report written to ${path.relative(process.cwd(), reportPath)}`);
    process.exit(0);
  }

  console.error(`FAIL control-plane validation (${report.summary.failed} failed checks)`);
  for (const error of report.errors) {
    console.error(`${error.file}: ${error.name}: ${error.message}`);
  }
  if (reportPath) console.error(`Report written to ${path.relative(process.cwd(), reportPath)}`);
  process.exit(1);
} catch (error) {
  console.error(error.message);
  process.exit(2);
}
