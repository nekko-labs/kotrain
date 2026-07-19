import type { ToolSpec } from '../providers/types.js';

/**
 * The built-in agent toolset. These specs are sent to the model; the actual
 * execution lives in the host (Electron main) so that filesystem/shell access
 * passes through the sandbox + guardrails layer.
 */
export const BUILTIN_TOOLS: ToolSpec[] = [
  {
    name: 'read_file',
    description: 'Read the contents of a file at an absolute or workspace-relative path.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to the file.' },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: 'Create or overwrite a file with the given contents.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        content: { type: 'string' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'edit_file',
    description: 'Replace an exact string in a file with a new string.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        old_string: { type: 'string', description: 'Exact text to replace (must be unique).' },
        new_string: { type: 'string' },
      },
      required: ['path', 'old_string', 'new_string'],
    },
  },
  {
    name: 'glob',
    description: 'Find files matching a glob pattern within the workspace.',
    parameters: {
      type: 'object',
      properties: { pattern: { type: 'string', description: 'e.g. src/**/*.ts' } },
      required: ['pattern'],
    },
  },
  {
    name: 'grep',
    description: 'Search file contents with a regular expression.',
    parameters: {
      type: 'object',
      properties: {
        pattern: { type: 'string' },
        path: { type: 'string', description: 'Optional directory to scope the search.' },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'list_dir',
    description: 'List the entries of a directory.',
    parameters: {
      type: 'object',
      properties: { path: { type: 'string' } },
      required: ['path'],
    },
  },
  {
    name: 'bash',
    description:
      'Run a shell command in the workspace. Subject to guardrails, risky commands require user approval.',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string' },
        cwd: { type: 'string', description: 'Optional working directory.' },
      },
      required: ['command'],
    },
  },
  {
    name: 'spawn_agent',
    description:
      'Delegate a self-contained sub-task to a fresh sub-agent that works in the same project with its own context, then returns its final answer. Use for parallelizable or well-scoped work (e.g. "investigate X", "implement Y in file Z"). The sub-agent appears as a nested tab in the workbench.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short label for the sub-agent tab.' },
        task: { type: 'string', description: 'The full, standalone instruction for the sub-agent.' },
      },
      required: ['task'],
    },
  },
];

/**
 * Extra tool offered only to sessions driven by a training/goal run: the agent
 * registers every attempt so the run's experiment tree (idea maze), stats, and
 * leader stay live in the Training/Goals tabs. Executed in the host.
 */
export const REPORT_EXPERIMENT_TOOL: ToolSpec = {
  name: 'report_experiment',
  description:
    'Record or update an experiment in this run\'s experiment tree. Call it when you START an attempt (status "running") and again when it finishes ("succeeded", "failed", or "repaired" if you fixed a failure), including the score when measured. Use parent_id to branch from the experiment you are iterating on. The tool result tells you the current leader.',
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Experiment id to update (omit to create a new one).' },
      parent_id: { type: 'string', description: 'Id of the experiment this one branches from.' },
      title: { type: 'string', description: 'Short pipeline-style title, e.g. "RobustScaler PCA RandomForest".' },
      approach: { type: 'string', description: 'The idea family, e.g. "gradient boosting", "feature engineering".' },
      status: { type: 'string', enum: ['planned', 'running', 'succeeded', 'failed', 'repaired'] },
      score: { type: 'number', description: 'Primary metric value when measured.' },
      metric: { type: 'string', description: 'Metric name, e.g. "cv r2", "accuracy".' },
      note: { type: 'string', description: 'One-line takeaway from this experiment.' },
    },
    required: ['title', 'status'],
  },
};

/**
 * Extra tool offered only to sessions driven by a training/goal run: goal runs
 * are plan-first, so the agent maintains its execution plan here (build it
 * before working, keep step statuses current, revise it when reality
 * disagrees). Drives the plan checklist on the Goals dashboard. Executed in
 * the host.
 */
export const UPDATE_PLAN_TOOL: ToolSpec = {
  name: 'update_plan',
  description:
    'Create or update this run\'s execution plan. Call it with replace=true and the full ordered step list to write the initial plan (do this BEFORE any execution work) or to re-plan. Without replace, steps are upserted by id: mark the step you are working "active", mark it "done" the moment it is verifiably complete (add a one-line note), or "skipped" with the reason. Keep the plan current every turn; the tool result echoes the plan so you know each step\'s id.',
  parameters: {
    type: 'object',
    properties: {
      replace: { type: 'boolean', description: 'Replace the whole plan with `steps` (initial plan or a re-plan).' },
      steps: {
        type: 'array',
        description: 'Plan steps, in execution order when replace=true.',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Step id to update (omit to create a new step).' },
            title: { type: 'string', description: 'Concrete, verifiable step, e.g. "Wire the CSV parser + unit tests".' },
            status: { type: 'string', enum: ['pending', 'active', 'done', 'skipped'] },
            note: { type: 'string', description: 'One-line outcome, blocker, or skip reason.' },
          },
          required: ['title'],
        },
      },
    },
    required: ['steps'],
  },
};
