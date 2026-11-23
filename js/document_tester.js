// ============================================================
//  document_tester.js — Enterprise Document RAG & Evaluation Tester
// ============================================================

const DocumentTester = {
  getTestCases() {
    return Storage.get("rag_test_cases", [
      {
        id: "test_1",
        query: "What is the data retention and local storage policy?",
        expectedAnswer: "Data stays strictly in browser localStorage with zero external network transmission.",
        lastRun: "2026-10-28",
        status: "passed",
        matchScore: 94,
        sourceDoc: "KnowledgeBase / Security Spec",
        snippet: "All chat histories, preferences, and documents remain strictly client-side on-device with zero telemetry.",
        overridden: false
      },
      {
        id: "test_2",
        query: "How does the AI Agent multi-step approval gate operate?",
        expectedAnswer: "Sensitive file modifications and script executions pause execution and mandate user consent.",
        lastRun: "2026-10-28",
        status: "passed",
        matchScore: 98,
        sourceDoc: "Agent Architecture v2.0",
        snippet: "Step requiresApproval flag pauses agent worker thread until human confirmation is explicitly granted.",
        overridden: false
      },
      {
        id: "test_3",
        query: "Can the application extract text from password-protected PDF files?",
        expectedAnswer: "Requires standard user-supplied decryption passphrase through PDF.js worker API.",
        lastRun: "2026-10-27",
        status: "warning",
        matchScore: 78,
        sourceDoc: "File Processing Guide",
        snippet: "Encrypted PDF handling depends on browser cryptographic support and user authentication entry.",
        overridden: true,
        overrideAnswer: "Manual override: Only unencrypted or user-unlocked PDFs are currently indexed."
      }
    ]);
  },

  saveTestCases(cases) {
    Storage.set("rag_test_cases", cases);
    Storage.addAuditLog("rag_test_cases_updated", { count: cases.length });
  },

  testDocumentQuery(query, customDocs = null) {
    if (!query || !query.trim()) return null;

    // Retrieve documents: FAQs, Knowledge Base, Notes, and any uploaded files
    const allDocs = customDocs || [
      ...KnowledgeBase.faqs.map(f => ({ id: f.id, source: "FAQ Knowledge Base", title: f.question, text: f.answer })),
      ...(Storage.getKBEntries() || []).map(k => ({ id: k.id, source: "Custom KB", title: k.question, text: k.answer })),
      ...(Storage.get("notes", []) || []).map(n => ({ id: n.id, source: "User Notes Studio", title: n.title, text: n.content }))
    ];

    const tokens = query.toLowerCase().replace(/[^\w\s\u0900-\u097F]/gi, ' ').split(/\s+/).filter(w => w.length > 2);
    if (!tokens.length) return { query, topMatches: [], bestScore: 0 };

    const scored = allDocs.map(doc => {
      const fullText = ((doc.title || "") + " " + (doc.text || "")).toLowerCase();
      let matchCount = 0;
      let matchedSnippets = [];

      tokens.forEach(t => {
        if (fullText.includes(t)) {
          matchCount++;
          // Locate snippet boundary
          const idx = fullText.indexOf(t);
          const start = Math.max(0, idx - 40);
          const end = Math.min(fullText.length, idx + 80);
          matchedSnippets.push("..." + fullText.substring(start, end).trim() + "...");
        }
      });

      const score = Math.min(99, Math.round((matchCount / tokens.length) * 100));
      return {
        id: doc.id,
        source: doc.source,
        title: doc.title,
        score: score,
        snippet: matchedSnippets[0] || (doc.text ? doc.text.substring(0, 100) + "..." : "No context")
      };
    }).filter(d => d.score > 0).sort((a, b) => b.score - a.score);

    return {
      query: query,
      bestScore: scored[0] ? scored[0].score : 0,
      topMatches: scored.slice(0, 4)
    };
  },

  runBatchEvaluation() {
    const cases = this.getTestCases();
    let passed = 0;
    let failed = 0;
    let totalScore = 0;

    const results = cases.map(c => {
      const evaluation = this.testDocumentQuery(c.query);
      const score = evaluation.bestScore;
      totalScore += score;
      const status = score >= 85 ? "passed" : score >= 60 ? "warning" : "failed";
      if (status === "passed") passed++; else failed++;

      c.matchScore = score;
      c.status = status;
      c.lastRun = new Date().toISOString().split("T")[0];
      if (evaluation.topMatches[0]) {
        c.snippet = evaluation.topMatches[0].snippet;
        c.sourceDoc = evaluation.topMatches[0].source;
      }
      return c;
    });

    this.saveTestCases(results);
    const avgScore = Math.round(totalScore / (cases.length || 1));

    return {
      total: cases.length,
      passed,
      failed,
      averageScore: avgScore,
      results
    };
  },

  addOverride(testId, overrideText) {
    const cases = this.getTestCases();
    const item = cases.find(c => c.id === testId);
    if (item) {
      item.overridden = true;
      item.overrideAnswer = overrideText;
      this.saveTestCases(cases);
      Storage.addAuditLog("rag_override_saved", { testId, overrideText });
    }
  }
};

// ============================================================
//  local_database.js — Embedded Local Database & RAG Storage Engine
// ============================================================

const LocalDatabase = {
  SCHEMA_VERSION: "2026.2",

  getCollection(name) {
    return Storage.get("db_" + name, []);
  },

  insert(name, document) {
    const coll = this.getCollection(name);
    const docWithMeta = {
      _id: "doc_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...document
    };
    coll.unshift(docWithMeta);
    Storage.set("db_" + name, coll);
    return docWithMeta;
  },

  find(name, filterFn = () => true) {
    const coll = this.getCollection(name);
    return coll.filter(filterFn);
  },

  update(name, id, updates) {
    const coll = this.getCollection(name);
    const idx = coll.findIndex(d => d._id === id);
    if (idx >= 0) {
      coll[idx] = { ...coll[idx], ...updates, updatedAt: new Date().toISOString() };
      Storage.set("db_" + name, coll);
      return coll[idx];
    }
    return null;
  },

  delete(name, id) {
    let coll = this.getCollection(name);
    coll = coll.filter(d => d._id !== id);
    Storage.set("db_" + name, coll);
  },

  getStats() {
    const collections = ["rag_documents", "agent_tasks", "audit_log", "notes", "conversations"];
    return collections.map(c => {
      const data = Storage.get("db_" + c, Storage.get(c, []));
      const sizeBytes = JSON.stringify(data).length * 2;
      return {
        collection: c,
        records: Array.isArray(data) ? data.length : 0,
        sizeKB: (sizeBytes / 1024).toFixed(1) + " KB"
      };
    });
  }
};

window.DocumentTester = DocumentTester;
window.LocalDatabase = LocalDatabase;
