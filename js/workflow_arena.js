// ============================================================
//  workflow.js — Drag-and-Drop Workflow Builder Engine
// ============================================================

const WorkflowBuilder = {
  getWorkflows() {
    return Storage.get("user_workflows", [
      {
        id: "wf_daily_summary",
        title: "Daily File & Tasks Auto-Summary",
        description: "Scans recent notes, condenses tasks, and logs proactive summary",
        nodes: [
          { id: "node_1", type: "trigger", title: "Schedule: Every Evening 6 PM", detail: "Timer Event" },
          { id: "node_2", type: "action", title: "Scan Saved Notes & PDFs", detail: "File System" },
          { id: "node_3", type: "ai", title: "Generate Bullet Executive Summary", detail: "Local AI Engine" },
          { id: "node_4", type: "output", title: "Send Smart Notification", detail: "Browser Notify" }
        ],
        active: true
      },
      {
        id: "wf_code_safety",
        title: "Code Review & Sandbox Safety Gate",
        description: "Audits JS scripts before execution in safe sandbox",
        nodes: [
          { id: "node_1", type: "trigger", title: "New Code Snippet Submitted", detail: "Chat/Code Runner" },
          { id: "node_2", type: "ai", title: "Static AST & Security Vulnerability Scan", detail: "Rule Engine" },
          { id: "node_3", type: "gate", title: "Wait for Human Approval", detail: "Permission Gate" },
          { id: "node_4", type: "action", title: "Run inside Sandboxed Context", detail: "Local Code Runner" }
        ],
        active: true
      }
    ]);
  },

  saveWorkflows(wfs) {
    Storage.set("user_workflows", wfs);
    Storage.addAuditLog("workflows_updated", { count: wfs.length });
  },

  addWorkflow(title, desc) {
    const list = this.getWorkflows();
    const newWf = {
      id: "wf_" + Date.now(),
      title,
      description: desc,
      nodes: [
        { id: "node_1", type: "trigger", title: "Trigger Event", detail: "Input condition" },
        { id: "node_2", type: "ai", title: "Process with Local AI", detail: "Prompt engine" },
        { id: "node_3", type: "output", title: "Store or Notify", detail: "Result output" }
      ],
      active: true
    };
    list.unshift(newWf);
    this.saveWorkflows(list);
    return newWf;
  },

  toggleWorkflow(id) {
    const list = this.getWorkflows();
    const wf = list.find(w => w.id === id);
    if (wf) {
      wf.active = !wf.active;
      this.saveWorkflows(list);
    }
  },

  deleteWorkflow(id) {
    let list = this.getWorkflows();
    list = list.filter(w => w.id !== id);
    this.saveWorkflows(list);
  }
};

// ============================================================
//  promptlab.js — Prompt Lab & Versioning
// ============================================================

const PromptLab = {
  getPrompts() {
    return Storage.get("prompt_lab_items", [
      {
        id: "prompt_agent_system",
        name: "Agent Step Planner Prompt",
        versions: [
          { v: "1.0", date: "2026-10-25", text: "Decompose user goals into 4 simple sequential steps.", active: false },
          { v: "2.0", date: "2026-10-28", text: "You are an autonomous AI Agent. Analyze the goal, break it down into tool-assisted steps, add safety gates for critical operations, and produce structured JSON.", active: true }
        ],
        currentVersion: "2.0"
      },
      {
        id: "prompt_summarizer",
        name: "Document Studio Summarizer",
        versions: [
          { v: "1.0", date: "2026-10-28", text: "Summarize the following document into key insights, action items, and risks.", active: true }
        ],
        currentVersion: "1.0"
      }
    ]);
  },

  addVersion(promptId, text) {
    const list = this.getPrompts();
    const p = list.find(item => item.id === promptId);
    if (!p) return;

    p.versions.forEach(v => v.active = false);
    const newVNum = (parseFloat(p.currentVersion) + 0.1).toFixed(1);
    p.versions.push({
      v: newVNum,
      date: new Date().toISOString().split("T")[0],
      text: text,
      active: true
    });
    p.currentVersion = newVNum;
    Storage.set("prompt_lab_items", list);
    Storage.addAuditLog("prompt_version_added", { promptId, version: newVNum });
  },

  rollback(promptId, versionNum) {
    const list = this.getPrompts();
    const p = list.find(item => item.id === promptId);
    if (!p) return;

    p.versions.forEach(v => v.active = (v.v === versionNum));
    p.currentVersion = versionNum;
    Storage.set("prompt_lab_items", list);
    Storage.addAuditLog("prompt_rollback", { promptId, version: versionNum });
  }
};

// ============================================================
//  arena.js — Model Arena (Side-by-Side Comparator)
// ============================================================

const ModelArena = {
  compare(prompt, modelA = "Rule-based FAQ", modelB = "Local Gemma 4 / Ollama") {
    // Generate simulated side-by-side responses
    const responseA = `**[${modelA}]**\n` + 
      (KnowledgeBase ? (KnowledgeBase.findAnswer(prompt)?.answer || `Direct keyword matches for: "${prompt}". Fast offline deterministic rule execution.`) : "Rule engine response.");
      
    const responseB = `**[${modelB}]**\n` + 
      `Analytical multi-perspective synthesis regarding "${prompt}":\n` +
      `1. Systematic context breakdown\n` +
      `2. Recommended actions & parameters\n` +
      `3. Local safety validation complete (Latency: 48ms, Zero network egress).`;

    return { modelA, modelB, responseA, responseB };
  }
};

// ============================================================
//  plugins.js — Reusable Agent Skills & Plugin System
// ============================================================

const PluginManager = {
  getSkills() {
    return Storage.get("agent_skills", [
      { id: "skill_file_scanner", name: "File Scanner", category: "System", enabled: true, desc: "Scans & indexes local text and PDF documents" },
      { id: "skill_code_sandbox", name: "Safe Code Sandbox", category: "Execution", enabled: true, desc: "Runs isolated JavaScript computations" },
      { id: "skill_semantic_search", name: "Semantic Search Index", category: "Intelligence", enabled: true, desc: "TF-IDF vector matching for natural search" },
      { id: "skill_doc_studio", name: "AI Document Studio", category: "Productivity", enabled: true, desc: "Generates structured exportable reports" },
      { id: "skill_browser_action", name: "Form Autofill & Browser Help", category: "Automation", enabled: true, desc: "Interactive form assistant & guidance" },
      { id: "skill_video_finder", name: "Video Moment Finder", category: "Multimodal", enabled: false, desc: "Indexed scene & timestamp discovery" }
    ]);
  },

  toggleSkill(id) {
    const skills = this.getSkills();
    const sk = skills.find(s => s.id === id);
    if (sk) {
      sk.enabled = !sk.enabled;
      Storage.set("agent_skills", skills);
      Storage.addAuditLog("skill_toggled", { id, enabled: sk.enabled });
    }
  }
};

window.WorkflowBuilder = WorkflowBuilder;
window.PromptLab = PromptLab;
window.ModelArena = ModelArena;
window.PluginManager = PluginManager;
