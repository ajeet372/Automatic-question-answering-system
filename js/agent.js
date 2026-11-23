// ============================================================
//  agent.js — AI Agent Mode (Multi-step Planner & Execution)
// ============================================================

const AIAgent = {
  activePlan: null,
  isPaused: false,
  isExecuting: false,

  createPlan(goal) {
    if (!goal || !goal.trim()) return null;
    const g = goal.trim().toLowerCase();
    
    // Decompose goal into intelligent multi-step plan
    let steps = [];
    if (g.includes("report") || g.includes("summary") || g.includes("summarize") || g.includes("file")) {
      steps = [
        { id: 1, title: "Analyze target documents & workspace files", tool: "File Scanner", status: "pending", requiresApproval: false },
        { id: 2, title: "Extract keywords & critical insights", tool: "Text Engine", status: "pending", requiresApproval: false },
        { id: 3, title: "Draft executive summary & structured sections", tool: "AI Generator", status: "pending", requiresApproval: false },
        { id: 4, title: "Verify findings & approve final report export", tool: "Safety Checker", status: "pending", requiresApproval: true },
        { id: 5, title: "Save formatted report to Document Studio", tool: "Storage Hub", status: "pending", requiresApproval: false }
      ];
    } else if (g.includes("code") || g.includes("script") || g.includes("app") || g.includes("bug")) {
      steps = [
        { id: 1, title: "Audit code structure & identify dependencies", tool: "Code Analyzer", status: "pending", requiresApproval: false },
        { id: 2, title: "Generate sandbox implementation script", tool: "Code Engine", status: "pending", requiresApproval: false },
        { id: 3, title: "Execute script in sandboxed environment", tool: "Sandbox Runner", status: "pending", requiresApproval: true },
        { id: 4, title: "Benchmark performance & output logs", tool: "Diagnostics", status: "pending", requiresApproval: false }
      ];
    } else if (g.includes("organize") || g.includes("clean") || g.includes("folder")) {
      steps = [
        { id: 1, title: "Scan directories for unorganized files & media", tool: "Directory Indexer", status: "pending", requiresApproval: false },
        { id: 2, title: "Categorize by file type, date and project tags", tool: "Semantic Classifier", status: "pending", requiresApproval: false },
        { id: 3, title: "Apply file organization & rename rules", tool: "File Manager", status: "pending", requiresApproval: true },
        { id: 4, title: "Log operations into system audit report", tool: "Audit Engine", status: "pending", requiresApproval: false }
      ];
    } else {
      steps = [
        { id: 1, title: `Deconstruct goal: "${goal}"`, tool: "Task Planner", status: "pending", requiresApproval: false },
        { id: 2, title: "Gather context from local memory & knowledge base", tool: "Knowledge Graph", status: "pending", requiresApproval: false },
        { id: 3, title: "Synthesize preliminary output and draft", tool: "Reasoning Engine", status: "pending", requiresApproval: false },
        { id: 4, title: "Authorize core modifications & execution", tool: "Permission Gate", status: "pending", requiresApproval: true },
        { id: 5, title: "Finalize solution & notify user", tool: "Notification System", status: "pending", requiresApproval: false }
      ];
    }

    this.activePlan = {
      id: "agent_task_" + Date.now(),
      goal: goal,
      createdAt: new Date().toISOString(),
      status: "ready", // ready, running, paused, waiting_approval, completed, cancelled
      currentStepIndex: 0,
      steps: steps,
      logs: [`Agent initialized with goal: "${goal}"`]
    };

    this.saveTaskToStorage(this.activePlan);
    return this.activePlan;
  },

  async runPlan(planId) {
    if (!this.activePlan || this.activePlan.id !== planId) return;
    this.isExecuting = true;
    this.isPaused = false;
    this.activePlan.status = "running";
    this.updateUI();

    while (this.activePlan.currentStepIndex < this.activePlan.steps.length) {
      if (this.isPaused) {
        this.activePlan.status = "paused";
        this.activePlan.logs.push("⏸️ Task execution paused by user.");
        this.updateUI();
        break;
      }

      const step = this.activePlan.steps[this.activePlan.currentStepIndex];
      
      // Check if step requires approval and isn't approved yet
      if (step.requiresApproval && !step.approved) {
        this.activePlan.status = "waiting_approval";
        this.activePlan.logs.push(`⚠️ Approval required for Step ${step.id}: "${step.title}"`);
        this.updateUI();
        this.isExecuting = false;
        return;
      }

      step.status = "in_progress";
      this.activePlan.logs.push(`⚙️ Running Step ${step.id}: ${step.title} (${step.tool})`);
      this.updateUI();

      // Simulate realistic local execution time
      await new Promise(r => setTimeout(r, 1200));

      step.status = "completed";
      this.activePlan.logs.push(`✅ Step ${step.id} completed successfully.`);
      this.activePlan.currentStepIndex++;
      this.saveTaskToStorage(this.activePlan);
      this.updateUI();
    }

    if (this.activePlan.currentStepIndex >= this.activePlan.steps.length) {
      this.activePlan.status = "completed";
      this.activePlan.logs.push(`🎉 All agent steps finished for: "${this.activePlan.goal}"`);
      this.isExecuting = false;
      this.saveTaskToStorage(this.activePlan);
      this.updateUI();
      if (window.SmartNotifications) {
        SmartNotifications.trigger("Agent Task Finished", `Task "${this.activePlan.goal}" successfully completed!`);
      }
    }
  },

  approveCurrentStep() {
    if (!this.activePlan) return;
    const step = this.activePlan.steps[this.activePlan.currentStepIndex];
    if (step && step.requiresApproval) {
      step.approved = true;
      this.activePlan.logs.push(`🛡️ Step ${step.id} approved by user.`);
      this.runPlan(this.activePlan.id);
    }
  },

  pausePlan() {
    this.isPaused = true;
  },

  resumePlan() {
    if (!this.activePlan) return;
    this.isPaused = false;
    this.runPlan(this.activePlan.id);
  },

  cancelPlan() {
    if (!this.activePlan) return;
    this.isPaused = false;
    this.isExecuting = false;
    this.activePlan.status = "cancelled";
    this.activePlan.logs.push("🛑 Agent task cancelled.");
    this.saveTaskToStorage(this.activePlan);
    this.updateUI();
  },

  saveTaskToStorage(task) {
    const tasks = Storage.get("agent_tasks", []);
    const idx = tasks.findIndex(t => t.id === task.id);
    if (idx >= 0) tasks[idx] = task;
    else tasks.unshift(task);
    Storage.set("agent_tasks", tasks.slice(0, 50));
    Storage.addAuditLog("agent_task_updated", { id: task.id, status: task.status, goal: task.goal });
  },

  updateUI() {
    if (window.renderAgentUI) window.renderAgentUI(this.activePlan);
  }
};

window.AIAgent = AIAgent;
