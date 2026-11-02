import os
import sys
import base64
import subprocess

def get_b64(path):
    if os.path.exists(path):
        with open(path, "rb") as f:
            ext = path.split('.')[-1].lower()
            mime = "image/png" if ext == "png" else ("image/jpeg" if ext in ["jpg", "jpeg"] else "image/webp")
            return f"data:{mime};base64,{base64.b64encode(f.read()).decode('utf-8')}"
    return ""

WORKSPACE = "/home/altaf07/Projects/FinLeaf"
img_home = get_b64(os.path.join(WORKSPACE, "design/HomePage.png"))
img_hero = get_b64(os.path.join(WORKSPACE, "apps/web/public/landing/hero-visual.png"))
img_logo = get_b64(os.path.join(WORKSPACE, "apps/web/public/landing/logo-header.png"))

with open("/tmp/finleaf_dossier.html", "w", encoding="utf-8") as out:
    def w(s=""):
        out.write(s + "\n")

    w("<!DOCTYPE html>")
    w("<html lang='en'>")
    w("<head>")
    w("<meta charset='utf-8'>")
    w("<title>FinLeaf: Technical Architecture and Feature Specification Dossier</title>")
    w("<style>")
    w("""
  @page {
    size: A4 portrait;
    margin: 18mm 16mm 18mm 16mm;
    @top-left {
      content: "FinLeaf: Technical Architecture & Feature Guide";
      font-size: 8pt;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #64748b;
      font-weight: 500;
    }
    @top-right {
      content: "IIIT Dharwad · Mini Project Report";
      font-size: 8pt;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #64748b;
    }
    @bottom-left {
      content: "Academic Evaluation Dossier · Submitted to Dr. Anushree Kini";
      font-size: 7.5pt;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #94a3b8;
    }
    @bottom-right {
      content: "Page " counter(page);
      font-size: 8pt;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-weight: 600;
      color: #15803d;
    }
  }

  @page :first {
    margin: 0;
    @top-left { content: none; }
    @top-right { content: none; }
    @bottom-left { content: none; }
    @bottom-right { content: none; }
  }

  *, *::before, *::after {
    box-sizing: border-box;
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    color: #1e293b;
    background-color: #ffffff;
    line-height: 1.5;
    font-size: 9.2pt;
    margin: 0;
    padding: 0;
  }

  .cover-container {
    width: 210mm;
    height: 297mm;
    box-sizing: border-box;
    padding: 22mm 20mm 18mm 20mm;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    background: linear-gradient(145deg, #052010 0%, #0d381e 50%, #051b0d 100%);
    color: #f8fafc;
    page-break-after: always;
    break-after: page;
    page-break-inside: avoid;
    break-inside: avoid;
  }

  .cover-title {
    page-break-before: avoid !important;
    break-before: avoid !important;
  }

  .cover-container + h1, body > h1:first-of-type {
    page-break-before: avoid !important;
    break-before: avoid !important;
  }

  .cover-header {
    border-bottom: 1.5px solid rgba(74, 222, 128, 0.35);
    padding-bottom: 16px;
  }

  .univ-title {
    font-size: 13pt;
    letter-spacing: 2px;
    font-weight: 700;
    color: #86efac;
    text-transform: uppercase;
    margin: 0 0 4px 0;
  }

  .dept-title {
    font-size: 9.5pt;
    letter-spacing: 0.5px;
    color: #cbd5e1;
    margin: 0;
  }

  .cover-badge {
    display: inline-block;
    background: rgba(34, 197, 94, 0.2);
    border: 1px solid rgba(74, 222, 128, 0.4);
    color: #bbf7d0;
    padding: 4px 12px;
    border-radius: 9999px;
    font-size: 8.5pt;
    font-weight: 600;
    letter-spacing: 0.5px;
    margin-top: 25px;
    margin-bottom: 12px;
  }

  .cover-title {
    font-size: 27pt;
    font-weight: 800;
    line-height: 1.15;
    color: #ffffff;
    margin: 0 0 12px 0;
    letter-spacing: -0.5px;
  }

  .cover-title span {
    color: #4ade80;
  }

  .cover-subtitle {
    font-size: 11pt;
    color: #94a3b8;
    line-height: 1.5;
    max-width: 90%;
    margin: 0 0 25px 0;
  }

  .cover-meta-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 14px 18px;
    margin-bottom: 25px;
  }

  .meta-item {
    font-size: 8.8pt;
  }

  .meta-label {
    color: #86efac;
    font-weight: 600;
    text-transform: uppercase;
    font-size: 7.2pt;
    letter-spacing: 1px;
    margin-bottom: 3px;
  }

  .meta-val {
    color: #f1f5f9;
    font-weight: 500;
  }

  .cover-footer {
    border-top: 1px solid rgba(255, 255, 255, 0.15);
    padding-top: 16px;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
  }

  .team-box h4 {
    margin: 0 0 6px 0;
    font-size: 8pt;
    text-transform: uppercase;
    color: #86efac;
    letter-spacing: 1px;
  }

  .team-box ul {
    list-style: none;
    padding: 0;
    margin: 0;
    font-size: 8.8pt;
    line-height: 1.45;
  }

  .team-box li {
    color: #e2e8f0;
  }

  .team-box li strong {
    color: #ffffff;
  }

  .eval-box {
    text-align: right;
  }

  .eval-box h4 {
    margin: 0 0 4px 0;
    font-size: 8pt;
    text-transform: uppercase;
    color: #86efac;
    letter-spacing: 1px;
  }

  .eval-box p {
    margin: 0;
    font-size: 8.8pt;
    color: #e2e8f0;
  }

  h1:not(.cover-title) {
    page-break-before: auto;
    break-before: auto;
    font-size: 14.5pt;
    border-bottom: 2px solid #16a34a;
    padding-bottom: 5px;
    margin-top: 0;
    margin-bottom: 12px;
    color: #14532d;
  }

  .cover-container + h1:not(.cover-title) {
    page-break-before: auto;
    break-before: auto;
  }

  h2 {
    font-size: 11.2pt;
    margin-top: 14px;
    margin-bottom: 6px;
    color: #1e293b;
    border-left: 3.5px solid #16a34a;
    padding-left: 7px;
    page-break-after: avoid;
    break-after: avoid;
  }

  h3 {
    font-size: 9.8pt;
    margin-top: 10px;
    margin-bottom: 4px;
    color: #334155;
    page-break-after: avoid;
    break-after: avoid;
  }

  p {
    margin-top: 0;
    margin-bottom: 8px;
    text-align: justify;
    line-height: 1.48;
    font-size: 9pt;
  }

  ul, ol {
    margin-top: 0;
    margin-bottom: 10px;
    padding-left: 18px;
  }

  li {
    margin-bottom: 3px;
    font-size: 9pt;
    line-height: 1.45;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin: 10px 0 14px 0;
    font-size: 8.4pt;
    line-height: 1.35;
    page-break-inside: avoid;
    break-inside: avoid;
  }

  th, td {
    padding: 6px 8px;
    border: 1px solid #cbd5e1;
    text-align: left;
  }

  th {
    background-color: #f1f5f9;
    color: #0f172a;
    font-weight: 600;
    font-size: 8pt;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border-bottom: 1.5px solid #94a3b8;
  }

  tr:nth-child(even) td {
    background-color: #f8fafc;
  }

  .callout {
    border-radius: 5px;
    padding: 8px 12px;
    margin: 10px 0;
    font-size: 8.8pt;
    line-height: 1.42;
    page-break-inside: avoid;
    break-inside: avoid;
  }

  .callout-info {
    background-color: #f0fdf4;
    border-left: 4px solid #16a34a;
    color: #14532d;
  }

  .callout-warn {
    background-color: #fefce8;
    border-left: 4px solid #ca8a04;
    color: #713f12;
  }

  .callout-navy {
    background-color: #f8fafc;
    border: 1px solid #e2e8f0;
    border-left: 4px solid #0f172a;
    color: #1e293b;
  }

  .callout-title {
    font-weight: 700;
    margin-bottom: 3px;
  }

  .arch-diagram {
    background: #0f172a;
    color: #f8fafc;
    padding: 12px;
    border-radius: 6px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 7.2pt;
    line-height: 1.3;
    margin: 10px 0;
    border: 1px solid #334155;
    page-break-inside: avoid;
    break-inside: avoid;
  }

  .code-block {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 5px;
    padding: 8px 10px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 7.8pt;
    color: #0f172a;
    line-height: 1.35;
    margin: 8px 0;
    page-break-inside: avoid;
    break-inside: avoid;
  }

  .grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin: 8px 0;
  }

  .card-box {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 5px;
    padding: 8px 10px;
    page-break-inside: avoid;
    break-inside: avoid;
  }

  .card-box-header {
    font-weight: 700;
    font-size: 8.8pt;
    color: #15803d;
    margin-bottom: 3px;
  }

  .img-frame {
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    overflow: hidden;
    margin: 10px 0;
    text-align: center;
    background: #f8fafc;
    page-break-inside: avoid;
    break-inside: avoid;
  }

  .img-frame img {
    max-width: 100%;
    height: auto;
    display: block;
  }

  .img-caption {
    font-size: 7.8pt;
    color: #64748b;
    padding: 5px 8px;
    background: #f1f5f9;
    border-top: 1px solid #e2e8f0;
    font-style: italic;
  }

  .formula-box {
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    border-radius: 5px;
    padding: 6px 10px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 8.4pt;
    color: #14532d;
    text-align: center;
    margin: 6px 0;
    font-weight: 600;
    page-break-inside: avoid;
    break-inside: avoid;
  }
""")
    w("</style>")
    w("</head>")
    w("<body>")

    # Cover Page
    w("<div class='cover-container'>")
    w("  <div class='cover-header'>")
    w("    <p class='univ-title'>Indian Institute of Information Technology Dharwad</p>")
    w("    <p class='dept-title'>Department of Computer Science and Engineering · Academic Year 2026–2027</p>")
    w("  </div>")
    w("  <div>")
    w("    <div class='cover-badge'>B.Tech Mini Project Technical Dossier & Feature Specification</div>")
    w("    <h1 class='cover-title'>FinLeaf: <span>Digital Banking</span> for Inclusion & Sustainability</h1>")
    w("    <p class='cover-subtitle'>A web-first, resilient architecture unifying low-literacy financial inclusion, behavioral alternative credit scoring, and GHG Protocol Scope 3.1 spend-based carbon accounting.</p>")
    w("    <div class='cover-meta-grid'>")
    w("      <div class='meta-item'><div class='meta-label'>Primary Framework</div><div class='meta-val'>Next.js 16 (App Router) & React 19</div></div>")
    w("      <div class='meta-item'><div class='meta-label'>Data Tier & Ledger</div><div class='meta-val'>PostgreSQL + Prisma 7 (Double-Entry Engine)</div></div>")
    w("      <div class='meta-item'><div class='meta-label'>Machine Learning Service</div><div class='meta-val'>Python FastAPI · HistGradientBoosting & Isolation Forest</div></div>")
    w("      <div class='meta-item'><div class='meta-label'>Sustainability Standards</div><div class='meta-val'>GHG Protocol Scope 3.1 & India CEA Baseline</div></div>")
    w("    </div>")
    w("  </div>")
    w("  <div class='cover-footer'>")
    w("    <div class='team-box'>")
    w("      <h4>Project Team Members</h4>")
    w("      <ul>")
    w("        <li><strong>Altaf Raja</strong> (23BCS011)</li>")
    w("        <li><strong>Alok Kumar Das</strong> (23BCS010)</li>")
    w("        <li><strong>Ankit Kumar Keshari</strong> (23BCS015)</li>")
    w("        <li><strong>Deependra Kumar Singh</strong> (23BCS039)</li>")
    w("      </ul>")
    w("    </div>")
    w("    <div class='eval-box'>")
    w("      <h4>Faculty Evaluator</h4>")
    w("      <p><strong>Dr. Anushree Kini</strong></p>")
    w("      <p style='color: #cbd5e1; font-size: 8pt;'>Assistant Professor, IIIT Dharwad</p>")
    w("      <p style='color: #86efac; font-size: 8pt; margin-top: 4px;'>October 2026</p>")
    w("    </div>")
    w("  </div>")
    w("</div>")

    # Chapter 1
    w("<h1>1. Executive Summary & Problem Formulation</h1>")
    w("<div class='callout callout-navy'>")
    w("<div class='callout-title'>Core Mandate & System Philosophy</div>")
    w("<em>\"Banking that reaches everyone, and is good for the planet.\"</em> FinLeaf bridges the gap between rural economic disenfranchisement and environmental blindness in retail banking. It delivers full-scale banking capabilities, an explainable alternative credit engine for credit-invisible citizens, and actionable carbon accounting on a single, unified responsive web platform.")
    w("</div>")

    w("<h2>1.1 The Dual Crisis in Modern Banking</h2>")
    w("<p>Contemporary digital banking systems suffer from two foundational structural failures that disproportionately harm developing economies:</p>")
    w("<ol>")
    w("<li><strong>Financial Exclusion of Underbanked Rural Populations:</strong> Traditional commercial banking assesses creditworthiness strictly through formalized credit bureau footprints (e.g., CIBIL/Experian). Rural artisans, smallholders, and daily-wage earners lack collateral, formal payslips, and prior loan histories, locking them out of institutional credit. While India's <em>Pradhan Mantri Jan Dhan Yojana (PMJDY)</em> expanded account ownership to over 89% of adults by 2024 (World Bank Global Findex 2025), a substantial proportion of these accounts remain dormant or underutilized due to digital illiteracy, intimidating UI complexity, and the total absence of alternative credit qualification.</li>")
    w("<li><strong>Environmental Blindness of Consumer Expenditure:</strong> Standard retail banking interfaces offer zero feedback regarding the ecological footprint of consumer spending. Banking workflows perpetuate physical branch visits, manual paperwork, and unmitigated high-emission consumption patterns without visibility or incentives for lower-carbon choices.</li>")
    w("</ol>")

    w("<h2>1.2 Global Empirical Precedents (World Bank Findex 2025)</h2>")
    w("<p>According to the World Bank's <em>Global Findex Database 2025 (\"Connectivity and Financial Inclusion in the Digital Economy\")</em>, approximately <strong>1.3 billion adults globally remain entirely unbanked</strong>, with over 50% concentrated in just eight developing nations, led by India. Within this excluded population:</p>")
    w("<ul>")
    w("<li><strong>55% are women</strong> facing systemic socio-economic barriers to branch banking.</li>")
    w("<li><strong>52% reside in the poorest 40%</strong> of national household income distributions.</li>")
    w("<li><strong>62% have completed only primary education</strong>, rendering conventional, text-heavy banking apps unusable.</li>")
    w("<li>Crucially, <strong>~900 million unbanked adults already own mobile phones</strong>, of which 530 million possess internet-capable smartphones. This directly justifies FinLeaf's responsive web architecture over native apps, enabling instant browser accessibility across low-spec hardware without app-store installation overhead.</li>")
    w("</ul>")

    w("<h2>1.3 Academic Prototype Scope & Engineering Honesty</h2>")
    w("<div class='callout callout-info'>")
    w("<div class='callout-title'>Honest System Boundaries (Declared Prototype Scope)</div>")
    w("FinLeaf is an engineered academic simulation designed to demonstrate full UX fidelity, mathematical rigor, and data integrity:")
    w("<ul style='margin: 4px 0 0 0; padding-left: 16px;'>")
    w("<li><strong>No Live Fiat Settlement:</strong> Does not connect to RBI-regulated live settlement networks (RTGS/NEFT/UPI/NPCI) or settle real utility bills.</li>")
    w("<li><strong>Zero Fabricated Mock Data:</strong> FinLeaf boots against an entirely clean database; no dummy balances or synthetic pre-populated transactions exist on startup. Transactions are generated exclusively through live user interaction.</li>")
    w("<li><strong>Explicit Estimation Disclosures:</strong> Every carbon emission figure and credit score is explicitly marked in the UI as an estimate derived from published methodology.</li>")
    w("</ul>")
    w("</div>")

    w("<h2>1.4 High-Level System Feature Matrix</h2>")
    w("<table>")
    w("<thead><tr><th style='width: 22%;'>Pillar</th><th style='width: 38%;'>Feature Capabilities</th><th style='width: 40%;'>Underlying Engineering Mechanism</th></tr></thead>")
    w("<tbody>")
    w("<tr><td><strong>Core Banking</strong></td><td>Onboarding, Auth, Wallet Accounts, Idempotent Transfers, CSV Statements, Utility Bills.</td><td>Postgres guarded row locks (<code>UPDATE ... WHERE balance >= amount</code>), immutable double-entry ledger.</td></tr>")
    w("<tr><td><strong>Financial Inclusion</strong></td><td>Trilingual UI (EN, HI, KN), Voice-first Web Speech API, Alternative Trust Score (0–100), Micro-Loans, Savings Goals.</td><td>8-feature behavioral ML model (GBDT/LR), RBI 2025 compliant counterfactual explainability, dynamic risk policies.</td></tr>")
    w("<tr><td><strong>Gamified Literacy</strong></td><td>Interactive Plain-Language Curriculum, Quizzes, Verifiable Badges, Community Trust Circles, Family Visibility.</td><td>Curated 3-language database, rule-evaluated badge progress engine, peer vouching graph with anti-collusion limits.</td></tr>")
    w("<tr><td><strong>Carbon Tracking</strong></td><td>Per-transaction CO₂e estimation, 6-month trends, Green Points, Composite Sustainability Score, Paperless counter.</td><td>GHG Protocol Scope 3.1 spend-based accounting, CEA grid baseline, Climatiq API with offline static fallback.</td></tr>")
    w("<tr><td><strong>Eco-Action</strong></td><td>Carbon Offset Marketplace, Village Leaderboard.</td><td>Green point redemption for verified rural CDM offsets (Cookstoves, Biogas, Solar, Trees), locality peer ranking.</td></tr>")
    w("<tr><td><strong>Safety &amp; Ops</strong></td><td>Anomaly &amp; Fraud Screening, Append-Only Audit Logs, Distributed Rate Limiter, Admin Console.</td><td>Unsupervised Isolation Forest (5% contamination rate), Postgres fixed-window atomic upserts, Bcrypt + HMAC auth.</td></tr>")
    w("</tbody></table>")

    # Chapter 2
    w("<h1>2. System Architecture & Technology Stack</h1>")
    w("<p>FinLeaf employs a decoupled, production-grade three-tier architecture engineered for modularity, strict data consistency, and graceful degradation during network partitions or microservice outages.</p>")

    w("<div class='arch-diagram'>")
    w("+---------------------------------------------------------------------------------------------------+")
    w("|                                         CLIENT BROWSER                                            |")
    w("|   Responsive Next.js 16 Web Tier  |  Web Speech API (TTS & STT)  |  Locales: English, Hindi, Kannada |")
    w("+-------------------------------------------------+-------------------------------------------------+")
    w("                                                  |  HTTPS / Server Actions")
    w("                                                  v")
    w("+---------------------------------------------------------------------------------------------------+")
    w("|                                     APPLICATION & BANKING TIER                                    |")
    w("|   Next.js 16 (App Router, Server Components)  |  Prisma 7 ORM  |  Stateless HMAC Session Engine  |")
    w("|   - Posting Engine (apps/web/src/lib/banking/ledger.ts): Atomic Row Locking & Double-Entry Invariants |")
    w("|   - Rule-Based Financial Assistant: Deterministic, Hallucination-Free Live Database Queries       |")
    w("|   - Rate Limiter: Postgres-backed Atomic Fixed-Window Token Buckets                               |")
    w("+-------------------+-----------------------------+-------------------------------+-----------------+")
    w("                    |                             |                               |")
    w("          SQL Query | Relational Data   HTTP REST | Trust & Anomaly Scoring       | HTTP REST (Optional)")
    w("                    v                             v                               v")
    w("+-----------------------------------+  +------------------------------------+  +--------------------+")
    w("|          DATA STORAGE             |  |         ML MICROSERVICE            |  |    CLIMATIQ API    |")
    w("|   PostgreSQL Relational DB        |  |   FastAPI (Python 3.14)            |  |   GHG Scope 3.1    |")
    w("|   - 31 Models (Prisma Schema)     |  |   - HistGradientBoostingClassifier |  |   Standards-based  |")
    w("|   - Decimal(14,2) Exact Balances  |  |   - LogisticRegression Scorecard   |  |   Carbon Factors   |")
    w("|   - Immutable LedgerEntry Rows    |  |   - Isolation Forest (Unsupervised)|  |   (Offline Fallback|")
    w("|   - Append-Only Security AuditLogs|  |   - Pre-computed Mean Vector Cache |  |    to Static Table)|")
    w("+-------------------+---------------+  +------------------------------------+  +--------------------+")
    w("</div>")

    w("<h2>2.1 Component Responsibility Matrix</h2>")
    w("<table>")
    w("<thead><tr><th style='width: 20%;'>Tier</th><th style='width: 25%;'>Technologies</th><th style='width: 55%;'>Core Architectural Responsibilities</th></tr></thead>")
    w("<tbody>")
    w("<tr><td><strong>Client Layer</strong></td><td>Next.js 16, React 19, Tailwind CSS, Lucide Icons</td><td>Responsive Web Design reflowing cleanly across 320px mobile screens to 4K displays; local client-side speech synthesis and recognition via browser-native <code>window.speechSynthesis</code> and <code>SpeechRecognition</code> without 3rd-party latency or telemetry.</td></tr>")
    w("<tr><td><strong>Banking Tier</strong></td><td>Node.js, TypeScript, Next.js Server Actions</td><td>Centralized business logic; coordinates double-entry ledger transactions; enforces idempotency; executes multilingual translations; manages session cookies and security guards.</td></tr>")
    w("<tr><td><strong>Database Tier</strong></td><td>PostgreSQL, Prisma 7 Client</td><td>Authoritative source of financial truth; enforces relational referential integrity across 31 tables; handles database row locks during transaction commits; stores immutable ledger audit trails.</td></tr>")
    w("<tr><td><strong>ML Microservice</strong></td><td>FastAPI, Uvicorn, Scikit-learn, NumPy, Joblib</td><td>Asynchronous microservice exposed on port 8000; provides endpoints for credit scoring, marginal attribution explanations, transaction anomaly detection, and held-out validation metrics.</td></tr>")
    w("</tbody></table>")

    w("<h2>2.2 Resilience Engineering: Graceful Runtime Degradation</h2>")
    w("<p>In real-world rural deployments, microservices or external cloud APIs may experience latency spikes or downtime. FinLeaf implements zero-failure fallback contracts across all external dependencies:</p>")
    w("<ul>")
    w("<li><strong>ML Microservice Decoupling:</strong> The Python ML service is strictly <em>optional at runtime</em>. If the service is unreachable (connection refused or timeout), credit scoring falls back seamlessly to an explicit, transparent weighted rule engine (<code>apps/web/src/lib/trust.ts</code>). Crucially, the interface explicitly labels which scoring path produced the result (<code>\"fallback-rules\"</code> vs <code>\"HistGradientBoostingClassifier\"</code>). A microservice sidecar outage will <em>never</em> block an eligible rural borrower from accessing credit.</li>")
    w("<li><strong>Carbon Provider Fallback:</strong> When the third-party <code>CLIMATIQ_API_KEY</code> is unconfigured or encounters quota exhaustion, carbon calculations instantly revert to the internal static emission factor table derived from India's Central Electricity Authority (CEA) database. Every transaction stores an immutable <code>co2eSource</code> tag (<code>\"climatiq\"</code> or <code>\"static-table\"</code>) for complete regulatory auditability.</li>")
    w("</ul>")

    if img_home:
        w("<div class='img-frame'>")
        w(f"<img src='{img_home}' alt='FinLeaf Interface Render' style='max-height: 230px; object-fit: contain; margin: 0 auto;' />")
        w("<div class='img-caption'>Figure 2.1: FinLeaf Desktop Dashboard showing Live Balance, Trust Score Gauge, Carbon Trends, and Quick Actions.</div>")
        w("</div>")

    # Chapter 3
    w("<h1>3. Relational Data Architecture (31 Models)</h1>")
    w("<p>FinLeaf's data model is defined as an unambiguous, strongly typed schema in <code>apps/web/prisma/schema.prisma</code>. The database enforces strict financial precision, cryptographic privacy, and non-destructive historical tracking.</p>")

    w("<div class='callout callout-warn'>")
    w("<div class='callout-title'>Financial Precision Mandate: Zero Floating-Point Arithmetic</div>")
    w("All monetary amounts are strictly persisted as <strong>Decimal(14,2)</strong> (supporting balances up to ₹999,999,999,999.99). Carbon emissions are persisted as <strong>Decimal(12,4)</strong>. Standard IEEE 754 binary floating-point types (<code>float</code>, <code>double</code>) are completely prohibited across the schema and application tier to eliminate fractional rounding drift.")
    w("</div>")

    w("<h2>3.1 Functional Model Grouping Across 31 Relational Tables</h2>")
    w("<div class='grid-2'>")
    w("<div class='card-box'><div class='card-box-header'>Identity, Auth &amp; Security (3 Models)</div><ul>")
    w("<li><code>User</code>: Authoritative identity keyed by E.164 phone; stores scores, village, role, status.</li>")
    w("<li><code>Otp</code>: Ephemeral 6-digit verification codes; stores SHA-256 hash, purpose, expiry.</li>")
    w("<li><code>Session</code>: Opaque revocable 256-bit random tokens; stored as SHA-256 hash.</li>")
    w("</ul></div>")
    w("<div class='card-box'><div class='card-box-header'>Core Banking &amp; Ledger (4 Models)</div><ul>")
    w("<li><code>Account</code>: 12-digit human-readable account number; materialized balance.</li>")
    w("<li><code>Transaction</code>: Business record, idempotency reference, CO₂e kg, anomaly score.</li>")
    w("<li><code>LedgerEntry</code>: Immutable double-entry row; DEBIT/CREDIT direction; balance after.</li>")
    w("<li><code>Biller</code>: Curated Indian utility operators with localized translation tags.</li>")
    w("</ul></div>")
    w("<div class='card-box'><div class='card-box-header'>Financial Inclusion &amp; Credit (4 Models)</div><ul>")
    w("<li><code>Loan</code>: Micro-credit record; tracks principal, outstanding, origin trust snapshot.</li>")
    w("<li><code>LoanRepayment</code>: Amortized repayment schedules and completed settlement links.</li>")
    w("<li><code>SavingsGoal</code>: Target-based savings goals with completion dates.</li>")
    w("<li><code>SavingsContribution</code>: Atomic debits allocated into specific goals.</li>")
    w("</ul></div>")
    w("<div class='card-box'><div class='card-box-header'>Literacy &amp; Gamification (5 Models)</div><ul>")
    w("<li><code>Lesson</code>: Curriculum module with trilingual JSON translations.</li>")
    w("<li><code>Quiz</code>: Formative multiple-choice questions per lesson.</li>")
    w("<li><code>QuizAttempt</code>: Scoring history, attempts, and percentage metrics.</li>")
    w("<li><code>Badge</code>: Master definitions of 11 verifiable badges.</li>")
    w("<li><code>LessonBadge</code> &amp; <code>UserBadge</code>: Many-to-many earned badge joins.</li>")
    w("</ul></div>")
    w("<div class='card-box'><div class='card-box-header'>Social Banking &amp; Trust Circles (6 Models)</div><ul>")
    w("<li><code>FamilyGroup</code>: Household units sharing financial visibility.</li>")
    w("<li><code>FamilyMember</code>: Member role and spending authorization flags.</li>")
    w("<li><code>FamilyInvitation</code>: Single-use SHA-256 hashed invite tokens.</li>")
    w("<li><code>TrustCircle</code>: Self-Help Groups (SHGs) linked to specific villages.</li>")
    w("<li><code>CircleMember</code>: Circle membership join table.</li>")
    w("<li><code>CircleVouch</code>: Weighted peer endorsements (1–5 scale).</li>")
    w("</ul></div>")
    w("<div class='card-box'><div class='card-box-header'>Sustainability &amp; Ops (9 Models)</div><ul>")
    w("<li><code>OffsetProject</code>: CDM/national certified rural offset projects.</li>")
    w("<li><code>OffsetContribution</code>: Green points spent to retire certified CO₂e.</li>")
    w("<li><code>Agent</code>: Banking correspondent kiosk directory (GPS + village).</li>")
    w("<li><code>TrustScoreSnapshot</code>: Immutable snapshot of features &amp; explanations.</li>")
    w("<li><code>AnomalyFlag</code>: Isolation Forest flagged review queue.</li>")
    w("<li><code>Notification</code>: Multi-category real-time user alerts.</li>")
    w("<li><code>ChatMessage</code>: Historical logs of deterministic assistant interactions.</li>")
    w("<li><code>AuditLog</code>: Security and financial append-only audit trail.</li>")
    w("<li><code>RateLimitBucket</code>: Postgres-backed atomic token bucket counters.</li>")
    w("</ul></div>")
    w("</div>")

    w("<h2>3.2 Core Enums &amp; Invariant Constraints</h2>")
    w("<p>The schema declares 12 strict PostgreSQL native enums to prevent invalid state persistence: <code>UserRole</code> (USER, ADMIN), <code>UserStatus</code> (PENDING_VERIFICATION, ACTIVE, SUSPENDED, CLOSED), <code>Locale</code> (en, hi, kn), <code>AccountStatus</code> (ACTIVE, FROZEN, CLOSED), <code>TxType</code> (DEPOSIT, WITHDRAW, TRANSFER_IN, TRANSFER_OUT, BILL_PAYMENT, RECHARGE, LOAN_DISBURSEMENT, LOAN_REPAYMENT, SAVINGS_CONTRIBUTION, GREEN_OFFSET), <code>TxStatus</code> (PENDING, COMPLETED, FLAGGED, DECLINED, REVERSED), <code>TxCategory</code> (21 categories), <code>LoanStatus</code>, <code>RepaymentStatus</code>, <code>CircleRole</code>, <code>LedgerDirection</code> (DEBIT, CREDIT), and <code>AuditAction</code>.</p>")

    # Chapter 4
    w("<h1>4. Core Banking &amp; Posting Engine Integrity</h1>")
    w("<p>At the foundation of FinLeaf is an enterprise-grade double-entry accounting engine implemented in <code>apps/web/src/lib/banking/ledger.ts</code>. Every financial operation satisfies rigorous mathematical and database invariants.</p>")

    w("<h2>4.1 The Atomic Posting Engine &amp; Overdraft Impossibility Proof</h2>")
    w("<p>A standard flaw in junior student banking projects is \"check-then-act\" application-level balance verification: reading balance in JavaScript, checking <code>balance >= amount</code>, and issuing an update. Under concurrent transfers, two simultaneous debits will read the initial balance before either commits, causing the account to overdraw into negative numbers.</p>")
    w("<p><strong>FinLeaf's Concurrency Guarantee:</strong> Balances are debited using a single, atomic, guarded SQL statement:</p>")

    w("<div class='code-block'>")
    w("// apps/web/src/lib/banking/ledger.ts (Lines 163-178)")
    w("const debitCount = await tx.$executeRaw`")
    w("  UPDATE \"Account\"")
    w("  SET balance = balance - ${debitAmount}::decimal,")
    w("      \"updatedAt\" = NOW()")
    w("  WHERE id = ${input.fromAccountId}")
    w("    AND balance >= ${debitAmount}::decimal;")
    w("`;")
    w("")
    w("if (debitCount === 0) {")
    w("  // The row lock held during statement execution re-evaluates the WHERE clause.")
    w("  // If concurrent debits reduced the balance below debitAmount, zero rows match.")
    w("  throw new InsufficientFundsError(availableStr, requestedStr);")
    w("}")
    w("</div>")

    w("<p><strong>Mathematical Concurrency Invariant:</strong> PostgreSQL acquires an exclusive row lock for the duration of the <code>UPDATE</code> statement. If five concurrent requests of ₹500 hit an account with ₹1,000 balance, exactly two requests match the <code>balance >= 500</code> predicate and decrement the balance to ₹0.00. The remaining three requests match zero rows and fail instantly with <code>InsufficientFundsError</code>. Overdrawing an account is mathematically impossible.</p>")

    w("<h2>4.2 Immutable Double-Entry Ledger Reconciliation</h2>")
    w("<p>For every completed transaction, the posting engine creates two immutable <code>LedgerEntry</code> records inside the same atomic database transaction:</p>")
    w("<ol>")
    w("<li>One <code>DEBIT</code> entry recording the exact balance of the sending account after deduction.</li>")
    w("<li>One <code>CREDIT</code> entry recording the exact balance of the receiving account after increment.</li>")
    w("</ol>")
    w("<p><strong>Reconciliation Invariant:</strong> At any point in time, the materialized balance on the <code>Account</code> table is mathematically identical to the historical sum of ledger entries:</p>")
    w("<div class='formula-box'>Account.balance == SUM(LedgerEntry[CREDIT].amount) - SUM(LedgerEntry[DEBIT].amount)</div>")

    w("<h2>4.3 Idempotency &amp; Replay Attack Prevention</h2>")
    w("<p>Network unreliability in rural environments frequently causes mobile clients to retry timed-out requests. If a transfer request is replayed, a naive system will double-debit the customer.</p>")
    w("<p>In FinLeaf, every transaction requires a unique client-supplied <code>reference</code> token (generated via cryptographic entropy in <code>generateReference()</code>). The database enforces a <code>@unique</code> constraint on <code>Transaction.reference</code>. If a replayed reference is submitted, the transaction catches the constraint violation and returns the original transaction details without executing an additional transfer.</p>")

    w("<h2>4.4 Real Indian Utility Bill Payments &amp; Recharges</h2>")
    w("<p>FinLeaf integrates master reference data for 11 genuine Indian public utilities and telecommunication operators in <code>apps/web/data/billers.json</code>:</p>")
    w("<table>")
    w("<thead><tr><th>Operator / Biller Name</th><th>Category</th><th>Reference ID Mask</th><th>Carbon Factor</th></tr></thead>")
    w("<tbody>")
    w("<tr><td><strong>BESCOM</strong> (Bangalore Electricity Supply)</td><td>ELECTRICITY</td><td>Consumer Number (10 digits)</td><td>1.9 kg CO₂e / ₹100</td></tr>")
    w("<tr><td><strong>HESCOM</strong> (Hubli Electricity Supply, Karnataka)</td><td>ELECTRICITY</td><td>Consumer Account ID</td><td>1.9 kg CO₂e / ₹100</td></tr>")
    w("<tr><td><strong>Mahadiscom</strong> (Maharashtra Electricity)</td><td>ELECTRICITY</td><td>Consumer Number</td><td>1.9 kg CO₂e / ₹100</td></tr>")
    w("<tr><td><strong>BSES Rajdhani</strong> (Delhi Electricity)</td><td>ELECTRICITY</td><td>CA Number (9 digits)</td><td>1.9 kg CO₂e / ₹100</td></tr>")
    w("<tr><td><strong>Indian Oil Corporation (IOCL)</strong></td><td>FUEL</td><td>LPG Consumer Number</td><td>2.5 kg CO₂e / ₹100</td></tr>")
    w("<tr><td><strong>Hindustan Petroleum (HPCL)</strong></td><td>FUEL</td><td>LPG Customer ID</td><td>2.5 kg CO₂e / ₹100</td></tr>")
    w("<tr><td><strong>Airtel / Jio / Vodafone Idea / BSNL</strong></td><td>RECHARGE</td><td>10-digit Mobile Number</td><td>0.1 kg CO₂e / ₹100</td></tr>")
    w("</tbody></table>")

    # Chapter 5
    w("<h1>5. Financial Inclusion &amp; Behavioral Alternative Credit</h1>")
    w("<p>FinLeaf removes structural barriers to banking for lower-literacy and credit-invisible individuals through multilingual voice interfaces, behavioral alternative credit scoring, and transparent micro-loans.</p>")

    w("<h2>5.1 Multilingual &amp; Voice-First Accessibility</h2>")
    w("<div class='grid-2'>")
    w("<div><h3>Native Trilingual Localization</h3><p>The entire application is natively translated into <strong>English (<code>en</code>)</strong>, <strong>Hindi (<code>hi</code>)</strong>, and <strong>Kannada (<code>kn</code>)</strong> (the local language of IIIT Dharwad and northern Karnataka). Every UI string, error message, lesson text, quiz question, and badge is keyed through <code>apps/web/src/lib/i18n.ts</code>. The automated integration test <code>i18n.test.ts</code> verifies 100% key parity across all three languages.</p></div>")
    w("<div><h3>Browser-Native Web Speech API</h3><p>To assist illiterate and low-literacy users, FinLeaf leverages the browser's native <code>window.speechSynthesis</code> and <code>SpeechRecognition</code> APIs (<code>apps/web/src/components/SpeakButton.tsx</code>):</p><ul><li>Audio playback rate calibrated to <strong>0.95x speed</strong> for enhanced rural comprehension.</li><li>Automatic Indian voice matching (<code>kn-IN</code>, <code>hi-IN</code>, <code>en-IN</code>).</li><li><strong>Zero Cloud Privacy Leakage:</strong> Audio is processed directly on the local mobile hardware without streaming recordings to 3rd-party servers.</li></ul></div>")
    w("</div>")

    w("<h2>5.2 The 8-Factor Behavioral Alternative Credit Scoring Model</h2>")
    w("<p>Because unbanked borrowers lack bureau credit scores, FinLeaf constructs an objective <strong>Trust Score (0–100)</strong> derived from eight behavioral signals harvested from the user's live ledger history (<code>apps/web/src/lib/trust.ts</code> and <code>apps/ml/app/features.py</code>):</p>")

    w("<table>")
    w("<thead><tr><th style='width: 24%;'>Feature Name</th><th style='width: 14%;'>Range</th><th style='width: 32%;'>Mathematical Formulation</th><th style='width: 30%;'>Behavioral / Economic Rationale</th></tr></thead>")
    w("<tbody>")
    w("<tr><td><code>savings_regularity</code></td><td>[0.0, 1.0]</td><td>clamp(Distinct Saving Months in Last 6 / 6)</td><td>Rewards savings habit and discipline over deposit volume.</td></tr>")
    w("<tr><td><code>on_time_bill_ratio</code></td><td>[0.0, 1.0]</td><td>Daytime Bills Paid (06:00-21:00) / Total Bills</td><td>Proxy for organized financial management during daytime hours.</td></tr>")
    w("<tr><td><code>txn_consistency</code></td><td>[0.0, 1.0]</td><td>1 - (std_dev / mean) across 90-day counts</td><td>Steady monthly transaction rhythm scores higher than erratic surges.</td></tr>")
    w("<tr><td><code>account_age_days</code></td><td>[0.0, 1.0]</td><td>min(1.0, Account Age in Days / 365)</td><td>Normalised tenure on the platform (saturates at 1 year).</td></tr>")
    w("<tr><td><code>group_activity</code></td><td>[0.0, 1.0]</td><td>min(1.0, Trust Circles Joined / 3)</td><td>Social capital and community engagement (saturates at 3 groups).</td></tr>")
    w("<tr><td><code>avg_balance_stability</code></td><td>[0.0, 1.0]</td><td>1 - (std_dev / mean) across ledger balances</td><td>Rewards low balance volatility and avoidance of rapid cash-drain.</td></tr>")
    w("<tr><td><code>monthly_txn_count</code></td><td>[0.0, 1.0]</td><td>min(1.0, Transactions in Last 30 Days / 30)</td><td>Active engagement metric (saturates at 1 transaction/day).</td></tr>")
    w("<tr><td><code>repayment_history</code></td><td>[0.0, 1.0]</td><td>On-Time Installments Paid / Total Due</td><td>Historical micro-loan credit performance on FinLeaf.</td></tr>")
    w("</tbody></table>")

    w("<h2>5.3 Regulatory Explainable AI (XAI) per RBI Digital Lending Directions 2025</h2>")
    w("<p>The Reserve Bank of India's <em>Digital Lending Directions, 2025</em> mandates that automated algorithmic credit decisions must provide human-interpretable justifications to borrowers. \"Black-box\" credit rejections are legally impermissible.</p>")
    w("<p>FinLeaf implements <strong>Marginal Counterfactual Perturbation Attribution</strong> against the population baseline vector (<code>apps/ml/app/models.py</code>, lines 405–420):</p>")

    w("<div class='code-block'>")
    w("// Counterfactual Attribution: Rescoring with feature reset to population mean")
    w("for i, feat in enumerate(FEATURES):")
    w("    perturbed = X.copy()")
    w("    perturbed[0, i] = population_mean_vector[i]")
    w("    delta_points = (predicted_proba - model.predict_proba(perturbed)) * 100.0")
    w("    contributions.append({'factor': feat, 'points': round(delta_points, 1)})")
    w("</div>")

    w("<p><strong>User-Facing Transparency:</strong> Rather than displaying uninterpretable model weights or log-odds, the FinLeaf UI presents an intuitive breakdown: <em>\"+14 pts for consistent savings regularity, +9 pts for on-time electricity bill payments, –6 pts for irregular transaction rhythm.\"</em> This establishes full regulatory explainability.</p>")

    # Chapter 6
    w("<h1>6. Micro-Loans &amp; Social Banking Architecture</h1>")
    w("<p>FinLeaf integrates programmatic micro-credit and decentralized social banking primitives to emulate traditional rural community support structures in a secure digital ecosystem.</p>")

    w("<h2>6.1 Algorithmic Micro-Loans &amp; Policy Bounds</h2>")
    w("<p>Micro-loans in FinLeaf (<code>apps/web/src/lib/banking/loans.ts</code>) are governed by an explicit, transparent product policy applied directly to the trust score:</p>")
    w("<div class='callout callout-navy'>")
    w("<div class='callout-title'>Algorithmic Loan Policy Formulations</div>")
    w("<ul>")
    w("<li><strong>Eligibility Gate:</strong> Borrowers require a minimum trust score of <strong>40 / 100</strong>. Below 40, credit is refused with clear guidance on how to raise the score.</li>")
    w("<li><strong>Dynamic Borrowing Limit:</strong> Linearly scaled between ₹500 and ₹50,000:<br><code>Max Principal = 500 + (50,000 - 500) * ((TrustScore - 40) / 60)</code></li>")
    w("<li><strong>Risk-Adjusted Annual Interest Rate:</strong> Declines linearly from 14.0% for new borrowers down to 6.0% for high-trust borrowers:<br><code>Annual Rate (r) = 14% - 8% * ((TrustScore - 40) / 60)</code></li>")
    w("<li><strong>Conservative Anti-Indebtedness Constraint:</strong> A user may hold exactly <em>one active loan at a time</em>. A second disbursement is blocked until the first is fully amortized.</li>")
    w("<li><strong>Auditable Snapshotting:</strong> Upon approval, the user's complete trust score snapshot, model type, and feature breakdown are permanently linked to the <code>Loan</code> row (RBI 2025 compliance).</li>")
    w("</ul></div>")

    w("<h2>6.2 Community Trust Circles &amp; Family Visibility</h2>")
    w("<div class='grid-2'>")
    w("<div><h3>Community Trust Circles (SHGs)</h3><p>Modeled after Indian microfinance <em>Self-Help Groups (SHGs)</em>:</p><ul><li>Users in the same village form groups and mutually vouch for each other (weights 1 to 5).</li><li><strong>Anti-Collusion Limits:</strong> Vouching is capped at one endorsement per pair per rolling 90-day window.</li><li><strong>Indirect Trust Score Impact:</strong> Vouching for an inactive user does not artificially inflate scores; the model evaluates actual group participation.</li></ul></div>")
    w("<div><h3>Family Group Visibility Accounts</h3><p>Addresses rural household financial management:</p><ul><li>Allows household heads to grant read-only balance and transaction visibility to family members.</li><li><strong>Cryptographic Onboarding:</strong> Invites utilize single-use 256-bit entropy tokens stored exclusively as SHA-256 hashes.</li><li><strong>Strict Separation of Spending:</strong> Visibility does not permit joint spending unless explicitly toggled by the owner.</li></ul></div>")
    w("</div>")

    # Chapter 7
    w("<h1>7. Gamified Financial Literacy &amp; Deterministic Assistant</h1>")
    w("<p>Financial education is integrated directly into daily banking operations, combining culturally relevant curricula, verifiable badge achievements, and a deterministic conversational assistant.</p>")

    w("<h2>7.1 Financial Literacy Curriculum, Quizzes &amp; Badges</h2>")
    w("<p>FinLeaf ships a pre-seeded, curated financial literacy curriculum in <code>apps/web/data/lessons.json</code> tailored for first-generation digital banking users:</p>")
    w("<table>")
    w("<thead><tr><th style='width: 25%;'>Curriculum Lesson</th><th style='width: 15%;'>Category</th><th style='width: 15%;'>Read Time</th><th style='width: 45%;'>Core Pedagogical Objectives</th></tr></thead>")
    w("<tbody>")
    w("<tr><td><strong>What a bank account actually is</strong></td><td>Basics</td><td>3 minutes</td><td>Security of insured accounts vs cash at home; transaction history as budgeting tool.</td></tr>")
    w("<tr><td><strong>How to save small amounts</strong></td><td>Saving</td><td>3 minutes</td><td>The power of daily micro-savings (₹10/day = ₹3,600/year); naming concrete goals.</td></tr>")
    w("<tr><td><strong>What interest means</strong></td><td>Borrowing</td><td>4 minutes</td><td>The cost of borrowing money; compound debt growth vs savings interest returns.</td></tr>")
    w("<tr><td><strong>Borrowing safely</strong></td><td>Borrowing</td><td>4 minutes</td><td>Distinguishing productive investment credit from predatory debt traps.</td></tr>")
    w("<tr><td><strong>Spotting and avoiding fraud</strong></td><td>Fraud</td><td>3 minutes</td><td>Strict instruction: Bank officials NEVER ask for OTPs or passwords over phone or WhatsApp.</td></tr>")
    w("<tr><td><strong>Checking your account</strong></td><td>Basics</td><td>3 minutes</td><td>Understanding balance statements, tracking expenses, and detecting billing discrepancies.</td></tr>")
    w("</tbody></table>")

    w("<h2>7.2 Verifiable Rule-Evaluated Badge System</h2>")
    w("<p>FinLeaf includes 11 verifiable badges evaluated programmatically in <code>apps/web/src/lib/badges.ts</code>. Badges can never be awarded arbitrarily; they reflect concrete database milestones:</p>")
    w("<ul>")
    w("<li><code>first-lesson</code>: Completed first financial literacy lesson.</li>")
    w("<li><code>curious-student</code>: Completed 3 distinct curriculum lessons.</li>")
    w("<li><code>scholar-of-the-basics</code>: Completed all lessons in the 'Basics' category.</li>")
    w("<li><code>saver-of-saver</code>: Created a dedicated target savings goal.</li>")
    w("<li><code>goal-reacher</code>: Successfully achieved 100% of a targeted savings goal.</li>")
    w("<li><code>quiz-perfect</code>: Achieved 100% on a literacy comprehension quiz attempt.</li>")
    w("<li><code>first-transaction</code>: Executed first peer-to-peer transfer or bill payment.</li>")
    w("<li><code>regular-user</code>: Completed 10+ ledger transactions.</li>")
    w("<li><code>trust-earned</code>: Achieved an algorithmic Trust Score >= 60.</li>")
    w("<li><code>offset-starter</code>: Funded first carbon offset project using Green Points.</li>")
    w("<li><code>eco-champion</code>: Earned 500+ cumulative Green Points.</li>")
    w("</ul>")

    w("<h2>7.3 Deterministic Rule-Based Financial Assistant</h2>")
    w("<p>Unlike modern generic fintech chatbots that connect users to large language models (LLMs), FinLeaf employs a <strong>deterministic, rule-based natural language assistant</strong> (<code>apps/web/src/lib/assistant.ts</code>):</p>")
    w("<ul>")
    w("<li><strong>Zero Hallucination Guarantee:</strong> An LLM answering \"How much do I owe on my loan?\" will frequently hallucinate plausible-sounding numbers. FinLeaf matches user intents against strict regex patterns and executes direct, real-time database queries against the user's live records.</li>")
    w("<li><strong>Supported Intents:</strong> Balance inquiries, recent transaction lookups, active loan status, savings goal progress, carbon totals, green points, and educational explanations (interest, fraud safety).</li>")
    w("<li><strong>Safe Fallback:</strong> Unmatched questions provide a clean, honest list of what the assistant can answer rather than speculating.</li>")
    w("</ul>")

    # Chapter 8
    w("<h1>8. Carbon-Conscious Banking &amp; Environmental Sustainability</h1>")
    w("<p>FinLeaf is the first academic prototype to integrate full <strong>spend-based carbon accounting</strong> directly into a retail banking platform, transforming routine financial statements into environmental impact insights.</p>")

    w("<h2>8.1 Spend-Based Carbon Accounting Methodology (GHG Protocol Scope 3.1)</h2>")
    w("<p>Measuring the exact physical emissions of retail purchases is impossible from bank ledgers alone, as payment gateways do not transmit itemized product supply chain data. FinLeaf adopts the internationally recognized <strong>GHG Protocol Corporate Value Chain (Scope 3) Category 3.1</strong> spend-based estimation standard—the identical method utilized by carbon fintech pioneers Climatiq, Doconomy, and Aspiration:</p>")
    w("<div class='formula-box'>CO2e (kg) = (Amount in INR / 100) * Factor_Category</div>")

    w("<h2>8.2 Indian Emission Factors &amp; Empirical Baselines</h2>")
    w("<p>Emission factors in <code>apps/web/src/lib/carbon/factors.ts</code> represent kilograms of CO₂-equivalent per ₹100 spent:</p>")
    w("<table>")
    w("<thead><tr><th style='width: 20%;'>Category</th><th style='width: 15%;'>kg CO₂e / ₹100</th><th style='width: 15%;'>Green Points</th><th style='width: 50%;'>Scientific Source &amp; Methodology Baseline</th></tr></thead>")
    w("<tbody>")
    w("<tr><td><strong>FUEL</strong></td><td><strong>2.50 kg</strong></td><td>0 pts</td><td>Direct combustion lifecycle emissions of petrol and diesel passenger fuel.</td></tr>")
    w("<tr><td><strong>ELECTRICITY</strong></td><td><strong>1.90 kg</strong></td><td>0 pts</td><td><strong>India Central Electricity Authority (CEA) CO₂ Baseline Database</strong> grid factor.</td></tr>")
    w("<tr><td><strong>TRAVEL_PRIVATE</strong></td><td><strong>1.40 kg</strong></td><td>0 pts</td><td>Lifecycle estimates for private auto-rickshaw, cab, and motorbike travel.</td></tr>")
    w("<tr><td><strong>TRAVEL_PUBLIC</strong></td><td><strong>0.35 kg</strong></td><td><strong>30 pts</strong></td><td>Bus and rail transit per passenger-km relative to private transport.</td></tr>")
    w("<tr><td><strong>GROCERIES</strong></td><td><strong>0.45 kg</strong></td><td><strong>15 pts</strong></td><td>Local rural produce and staple grains; low packaging and cold-chain intensity.</td></tr>")
    w("<tr><td><strong>DINING</strong></td><td><strong>0.80 kg</strong></td><td>0 pts</td><td>Commercial food preparation and commercial LPG combustion overhead.</td></tr>")
    w("<tr><td><strong>ELECTRONICS</strong></td><td><strong>0.60 kg</strong></td><td>0 pts</td><td>Embodied manufacturing emissions of consumer electronics per retail rupee.</td></tr>")
    w("<tr><td><strong>RECHARGE / BILL</strong></td><td><strong>0.10 kg</strong></td><td><strong>20 pts</strong></td><td>Digital service overhead; rewarded for displacing physical branch/agent visits.</td></tr>")
    w("</tbody></table>")

    w("<div class='callout callout-navy'>")
    w("<div class='callout-title'>Proposal Worked Example Cross-Verification</div>")
    w("<strong>Worked Example:</strong> ₹2,000 spent on fuel at a factor of 2.5 kg CO₂e per ₹100:<br>")
    w("<code>Footprint = (2000 / 100) * 2.5 = 20 * 2.5 = 50.0 kg CO2e</code><br>")
    w("This exact calculation is verified programmatically in the unit test <code>apps/web/src/lib/__tests__/carbon.test.ts</code>.")
    w("</div>")

    w("<h2>8.3 Composite Sustainability Score Formulation</h2>")
    w("<p>FinLeaf computes a comprehensive <strong>Sustainability Score (0–100)</strong> (<code>apps/web/src/lib/sustainability.ts</code>) combining expenditure choices and active conservation engagement:</p>")
    w("<div class='formula-box'>Sustainability Score = round(0.5 * GreenShare + 0.5 * min(1.0, GreenPoints / 400)) * 100</div>")
    w("<p>where GreenShare represents the weighted fraction of expenditure directed toward lower-carbon goods.</p>")

    w("<h2>8.4 Paperless Banking Impact Metrics</h2>")
    w("<p>FinLeaf tracks cumulative digital savings vs physical branch paperwork:<br>")
    w("<code>Sheets Saved = (Transactions * 1.0) + (Bill Payments * 2.0)</code><br>")
    w("<code>Trees Spared = Sheets Saved / 8333.33</code> | <code>CO2e Avoided = Sheets Saved * 0.005 kg</code></p>")

    w("<h2>8.5 Certified Rural Carbon Offset Marketplace</h2>")
    w("<p>Users can spend earned Green Points to fund verified Indian rural sustainability projects in <code>apps/web/data/offset-projects.json</code>:</p>")
    w("<table>")
    w("<thead><tr><th>Project Initiative</th><th>Point Cost</th><th>Impact / Unit</th><th>Validated Regulatory Methodology Source</th></tr></thead>")
    w("<tbody>")
    w("<tr><td><strong>Clean Cookstoves</strong></td><td>200 pts</td><td>120.0 kg CO₂e</td><td>Gold Standard CDM methodology replacing kerosene stoves.</td></tr>")
    w("<tr><td><strong>Native Tree Planting</strong></td><td>150 pts</td><td>22.0 kg CO₂e</td><td>Indian National Afforestation Programme (10-year mixed species rotation).</td></tr>")
    w("<tr><td><strong>Solar Lamp Distribution</strong></td><td>400 pts</td><td>45.0 kg CO₂e</td><td>Off-grid rural solar lighting displacing household paraffin lamps.</td></tr>")
    w("<tr><td><strong>Household Biogas Plants</strong></td><td>900 pts</td><td>350.0 kg CO₂e</td><td>National Biogas Development Programme (DBT) displacing firewood.</td></tr>")
    w("</tbody></table>")

    # Chapter 9
    w("<h1>9. Machine Learning Microservice &amp; Anomaly Detection</h1>")
    w("<p>The FinLeaf ML microservice (<code>apps/ml</code>) is implemented as a standalone asynchronous Python application using <strong>FastAPI</strong> and <strong>Scikit-learn</strong>. Isolating machine learning workloads into a dedicated service prevents CPU-intensive model evaluations from starving the web tier.</p>")

    w("<h2>9.1 Microservice API Endpoints</h2>")
    w("<table>")
    w("<thead><tr><th style='width: 15%;'>Method</th><th style='width: 25%;'>Endpoint Path</th><th style='width: 60%;'>Operational Purpose &amp; Processing Workflow</th></tr></thead>")
    w("<tbody>")
    w("<tr><td><code>POST</code></td><td><code>/ml/trust-score</code></td><td>Evaluates 8 behavioral features; returns 0–100 score, probability, and per-factor point breakdown.</td></tr>")
    w("<tr><td><code>POST</code></td><td><code>/ml/anomaly-score</code></td><td>Screens transactions using Isolation Forest; returns 0–1 anomaly score, flag, and human-readable reasons.</td></tr>")
    w("<tr><td><code>POST</code></td><td><code>/ml/carbon</code></td><td>Computes estimated CO₂e for a given rupee amount and category.</td></tr>")
    w("<tr><td><code>GET</code></td><td><code>/model/metrics</code></td><td>Serves cached held-out validation metrics (Accuracy, Recall, Precision, AUC-ROC) from disk.</td></tr>")
    w("<tr><td><code>GET</code></td><td><code>/health</code> &amp; <code>/ready</code></td><td>Liveness and readiness probes verifying all serialized model artifacts are loaded in memory.</td></tr>")
    w("</tbody></table>")

    w("<h2>9.2 Dual Credit Scoring Models: Logistic Regression vs. GBDT</h2>")
    w("<div class='grid-2'>")
    w("<div class='card-box'><div class='card-box-header'>1. Logistic Regression Scorecard (Baseline)</div><p style='font-size: 8.8pt;'>Traditional banking scorecard structure. Features scaled via <code>StandardScaler</code>. Linear model provides direct auditability where each feature possesses a single signed weight coefficient.</p><div style='font-size: 8.2pt; color: #15803d; font-weight: 600;'>Held-out AUC-ROC: 0.9884 · Accuracy: 94.0%</div></div>")
    w("<div class='card-box'><div class='card-box-header'>2. HistGradientBoostingClassifier (Advanced)</div><p style='font-size: 8.8pt;'>Gradient-boosted decision tree ensemble. Automatically captures complex non-linear feature interactions (e.g., regular savings only boosts creditworthiness if bill payments are also on time).</p><div style='font-size: 8.2pt; color: #15803d; font-weight: 600;'>Held-out AUC-ROC: 0.9839 · Accuracy: 92.5%</div></div>")
    w("</div>")

    w("<h2>9.3 Unsupervised Anomaly Detection (Isolation Forest)</h2>")
    w("<p>Because genuine fraud cases are extremely rare in banking and student prototypes cannot ethically acquire real fraud labels, supervised classification suffers from destructive class imbalance. FinLeaf treats transaction screening as an <strong>unsupervised anomaly detection</strong> task using an <strong>Isolation Forest</strong> (200 estimators, 5% contamination rate) across 5 features: <code>amount_log</code>, <code>hour_of_day</code>, <code>rapid_repeat</code>, <code>new_counterparty</code>, and <code>category_rarity</code>.</p>")

    w("<div class='callout callout-warn'>")
    w("<div class='callout-title'>Human-in-the-Loop Philosophy: Flagging vs. Blocking</div>")
    w("A flagged transaction is <strong>NEVER auto-blocked</strong>. Automatically blocking transactions in rural environments can strand a daily-wage worker trying to buy emergency medicine at 2:00 AM. Instead, the transaction completes, is flagged on the admin review queue, and generates a polite <em>\"Was this you?\"</em> prompt in the user's dashboard with human-readable explanations.")
    w("</div>")

    w("<h2>9.4 Ethical AI: Rigorous Exclusion of Protected Demographic Attributes</h2>")
    w("<p>The synthetic population generator (<code>apps/ml/app/training_data.py</code>) strictly excludes all protected demographic attributes: <strong>no caste, gender, religion, marital status, or age brackets</strong> exist in the feature set or models, eliminating demographic proxy discrimination.</p>")

    # Chapter 10
    w("<h1>10. Security Architecture, Governance &amp; Administration</h1>")
    w("<p>FinLeaf adheres to enterprise security standards, ensuring that data privacy, credential protection, and operational oversight are maintained across all application tiers.</p>")

    w("<h2>10.1 Cryptographic Defense-in-Depth</h2>")
    w("<table>")
    w("<thead><tr><th style='width: 25%;'>Component</th><th style='width: 30%;'>Cryptographic Mechanism</th><th style='width: 45%;'>Security Justification &amp; Attack Mitigation</th></tr></thead>")
    w("<tbody>")
    w("<tr><td><strong>Passwords</strong></td><td>Bcrypt (Work Factor 12)</td><td>Protects user passwords against GPU-accelerated rainbow table and offline dictionary attacks.</td></tr>")
    w("<tr><td><strong>One-Time Codes (OTP)</strong></td><td>HMAC-SHA256 Digest Hash</td><td>Plaintext 6-digit codes are NEVER stored in the database. A database leak cannot expose active OTPs.</td></tr>")
    w("<tr><td><strong>Session Management</strong></td><td>Opaque 256-bit Random Token in HttpOnly Cookie</td><td>Tokens stored only as SHA-256 hashes in database. Enables instant server-side revocation (unlike JWTs).</td></tr>")
    w("<tr><td><strong>Government IDs</strong></td><td>Strictly Excluded from Schema</td><td>No Aadhaar, PAN, or voter IDs are collected, eliminating regulatory liability under Indian DPDP Act 2023.</td></tr>")
    w("</tbody></table>")

    w("<h2>10.2 Distributed Atomic Rate Limiting</h2>")
    w("<p>To protect against SMS-toll fraud, brute-force OTP guessing, and transfer spam, FinLeaf implements a PostgreSQL-backed fixed-window rate limiter in <code>apps/web/src/lib/rate-limit.ts</code>:</p>")
    w("<div class='code-block'>")
    w("// Atomic Upsert: Cross-instance rate limiting without Redis dependencies\n")
    w("INSERT INTO \"RateLimitBucket\" (key, count, \"windowStart\", \"expiresAt\")\n")
    w("VALUES ($1, 1, $2, $3)\n")
    w("ON CONFLICT (key) DO UPDATE\n")
    w("SET count = \"RateLimitBucket\".count + 1\n")
    w("RETURNING count;\n")
    w("</div>")
    w("<p>Because the atomic upsert runs inside PostgreSQL, rate-limiting invariants hold across multiple clustered container instances without needing an external Redis cache.</p>")

    w("<h2>10.3 Append-Only Security &amp; Financial Audit Log</h2>")
    w("<p>All sensitive actions (sign-in, OTP requests, transfers, loan applications, administrative overrides) are recorded in an append-only <code>AuditLog</code> table. Each entry stores the timestamp, actor user ID, client IP address, User-Agent header, action enum, and structured JSON context metadata.</p>")

    w("<h2>10.4 Administrator Control Center (<code>/admin</code>)</h2>")
    w("<p>Access to the admin dashboard is enforced strictly at the database level via <code>requireAdmin()</code>. The console provides real-time governance:</p>")
    w("<ul>")
    w("<li><strong>System Liveness Monitors:</strong> Real-time healthcheck status for both PostgreSQL and the Python ML microservice.</li>")
    w("<li><strong>Held-Out Model Scorecard:</strong> Live inspection of ML accuracy, recall, and AUC-ROC curves.</li>")
    w("<li><strong>Anomaly Triage Queue:</strong> Reviewing and resolving transactions flagged by the Isolation Forest.</li>")
    w("<li><strong>User Directory &amp; Moderation:</strong> Searching users by phone or village; modifying roles; suspending compromised accounts.</li>")
    w("<li><strong>Banking Correspondent (BC) Registry:</strong> Provisioning verified local agents with GPS coordinates, shop names, and operating hours.</li>")
    w("</ul>")

    # Chapter 11
    w("<h1>11. Empirical Verification &amp; Testing Methodology</h1>")
    w("<p>FinLeaf's reliability is proven through a multi-tier test matrix covering unit arithmetic, database concurrency invariants, and machine learning boundary conditions.</p>")

    w("<h2>11.1 Test Suite Breakdown</h2>")
    w("<table>")
    w("<thead><tr><th style='width: 25%;'>Test Suite</th><th style='width: 20%;'>Test Framework</th><th style='width: 55%;'>Verified Invariants &amp; Safety Guarantees</th></tr></thead>")
    w("<tbody>")
    w("<tr><td><code>ledger.integration.test.ts</code></td><td>Vitest + Live PostgreSQL</td><td>Proves double-entry conservation (credits minus debits equals account balance), overdraft refusal, balance draining to exactly zero, transaction idempotency, and <strong>five concurrent debits serializing safely</strong> without overdraft.</td></tr>")
    w("<tr><td><code>carbon.test.ts</code></td><td>Vitest</td><td>Verifies ₹2,000 fuel -> 50 kg CO₂e worked example, decimal arithmetic precision, and category fallback behavior.</td></tr>")
    w("<tr><td><code>i18n.test.ts</code></td><td>Vitest</td><td>Verifies 100% dictionary key parity across English, Hindi, and Kannada, ensuring no placeholder variables are corrupted.</td></tr>")
    w("<tr><td><code>test_trust_score.py</code></td><td>Pytest + FastAPI Client</td><td>Guarantees model selector (<code>gb</code> vs <code>lr</code>) functions correctly; ensures factor explanations sum properly; verifies out-of-range inputs return 422 errors.</td></tr>")
    w("<tr><td><code>test_anomaly.py</code></td><td>Pytest</td><td>Guarantees Isolation Forest request schema matches model features; ensures <code>reasons</code> list is never empty; verifies action matches anomaly flag.</td></tr>")
    w("<tr><td><code>test_metrics_and_carbon.py</code></td><td>Pytest</td><td>Guarantees <code>/model/metrics</code> reads from cache without re-fitting models; verifies synthetic provenance label is preserved.</td></tr>")
    w("</tbody></table>")

    w("<h2>11.2 Official Machine Learning Validation Metrics</h2>")
    w("<table>")
    w("<thead><tr><th>Model Architecture</th><th>Accuracy</th><th>Precision</th><th>Recall</th><th>AUC-ROC</th><th>Operational Role</th></tr></thead>")
    w("<tbody>")
    w("<tr><td><strong>Logistic Regression Scorecard</strong></td><td><strong>94.00%</strong></td><td><strong>94.34%</strong></td><td><strong>94.77%</strong></td><td><strong>0.9884</strong></td><td>Transparent baseline credit scorecard.</td></tr>")
    w("<tr><td><strong>HistGradientBoostingClassifier</strong></td><td><strong>92.50%</strong></td><td><strong>92.60%</strong></td><td><strong>93.86%</strong></td><td><strong>0.9839</strong></td><td>Advanced non-linear interaction model.</td></tr>")
    w("<tr><td><strong>Isolation Forest Anomaly Detector</strong></td><td colspan='4'>Contamination: <strong>5.0%</strong> · Score Range: <strong>[0.401422, 0.673249]</strong></td><td>Unsupervised payment anomaly screening.</td></tr>")
    w("</tbody></table>")

    # Chapter 12
    w("<h1>12. Academic Viva Voce Defense Guide &amp; Demo Script</h1>")
    w("<p>This section prepares the project team for technical and conceptual questions anticipated from the project evaluation committee and faculty supervisor <strong>Dr. Anushree Kini</strong>.</p>")

    w("<div class='callout callout-info'>")
    w("<div class='callout-title'>Q1: Why did you use synthetic data instead of a real-world banking dataset?</div>")
    w("<strong>Answer:</strong> \"Labelled micro-lending repayment data for Indian rural borrowers is proprietary, highly regulated under RBI privacy mandates, and completely unavailable as an open-source corpus. Using an irrelevant foreign dataset (such as US mortgage or German credit data) would introduce completely erroneous demographic biases. Instead, we designed a seeded synthetic population in <code>apps/ml/app/training_data.py</code> based on published alternative-credit-scoring distributions (Tala and Branch International). Crucially, we write this synthetic provenance directly into the model metadata and API responses, satisfying academic integrity.\"")
    w("</div>")

    w("<div class='callout callout-info'>")
    w("<div class='callout-title'>Q2: How does your system guarantee that an account cannot be overdrawn under heavy concurrency?</div>")
    w("<strong>Answer:</strong> \"Application-level checks (reading balance, comparing in JavaScript, then updating) suffer from check-then-act race conditions. In FinLeaf, all debits execute via a single atomic SQL statement: <code>UPDATE Account SET balance = balance - debit WHERE id = accId AND balance >= debit</code>. PostgreSQL acquires a row-level write lock on the account row. If concurrent requests arrive simultaneously, the database serializes them; the second request re-evaluates the <code>WHERE</code> clause against the newly committed balance, matches zero rows, and fails safely. This is mathematically proven in our integration test suite <code>ledger.integration.test.ts</code>.\"")
    w("</div>")

    w("<div class='callout callout-info'>")
    w("<div class='callout-title'>Q3: How does FinLeaf comply with the RBI's Digital Lending Directions 2025 regarding AI explainability?</div>")
    w("<strong>Answer:</strong> \"The RBI's 2025 directions require digital lenders to disclose the exact basis of automated credit decisions. We implement marginal counterfactual attribution in <code>apps/ml/app/models.py</code>. By re-scoring the user with each feature sequentially reset to the population mean vector, we compute the exact point contribution of each feature on the 0–100 scale. The UI displays clear breakdowns like '+14 points for regular savings, –6 points for erratic activity'. Furthermore, whenever a loan is originated, we capture an immutable <code>TrustScoreSnapshot</code> containing the exact model and feature values at that moment.\"")
    w("</div>")

    w("<div class='callout callout-info'>")
    w("<div class='callout-title'>Q4: Why did you adopt spend-based carbon accounting instead of physical activity measurement?</div>")
    w("<strong>Answer:</strong> \"Retail banking ledgers only record transaction amounts and merchant categories—they do not possess physical data like fuel liters or flight kilometers. Spend-based estimation under GHG Protocol Corporate Standard Scope 3.1 is the internationally recognized industry standard adopted by fintech leaders like Climatiq, Doconomy, and Aspiration. We calibrated our electricity factor to India's Central Electricity Authority baseline (1.9 kg CO₂e / ₹100) and fuel to lifecycle combustion tables (2.5 kg CO₂e / ₹100), ensuring transparent and defensible numbers.\"")
    w("</div>")

    w("<div class='callout callout-info'>")
    w("<div class='callout-title'>Q5: Why did you build a rule-based assistant rather than integrating a Large Language Model (LLM)?</div>")
    w("<strong>Answer:</strong> \"In banking, an assistant that hallucinates an account balance or debt amount is catastrophic. An LLM generating responses from conversational context can fabricate numbers that a rural user cannot easily verify. FinLeaf's assistant is intentionally deterministic: it uses regex intent matching and executes live SQL queries against the user's actual database rows. It only reports ground-truth data from the database, eliminating hallucination risks entirely.\"")
    w("</div>")

    w("<div class='callout callout-info'>")
    w("<div class='callout-title'>Q6: What happens if the Python ML microservice crashes in production?</div>")
    w("<strong>Answer:</strong> \"The platform is engineered for zero-failure graceful degradation. The web application treats the ML service as optional at runtime. If the FastAPI microservice is unreachable, the banking tier automatically falls back to an explicit weighted rule set in <code>apps/web/src/lib/trust.ts</code> and labels the score origin as 'fallback-rules'. Loan applications and daily transfers proceed uninterrupted.\"")
    w("</div>")

    w("<h2>12.1 Step-by-Step Live Demonstration Protocol (5-Minute Viva Walkthrough)</h2>")
    w("<p>Follow this exact sequence during the project viva evaluation to demonstrate all system capabilities:</p>")

    w("<div class='card-box' style='margin-bottom: 8px;'>")
    w("<div class='card-box-header'>Step 1: Onboarding, Language Switching &amp; Voice Interaction (1 Minute)</div>")
    w("<ol style='margin-bottom: 0;'>")
    w("<li>Navigate to <code>http://localhost:3000</code>. Showcase the landing page and impact calculator.</li>")
    w("<li>Click the language switcher in the navigation bar to toggle to <strong>Kannada (ಕನ್ನಡ)</strong> and <strong>Hindi (हिन्दी)</strong>, showing complete interface translation.</li>")
    w("<li>Sign in using a test phone number. Click the <strong>\"Listen\" (SpeakButton)</strong> to demonstrate browser-native speech synthesis reading account guidance aloud in the selected language.</li>")
    w("</ol></div>")

    w("<div class='card-box' style='margin-bottom: 8px;'>")
    w("<div class='card-box-header'>Step 2: Core Banking, Instant Transfers &amp; Ledger Proof (1 Minute)</div>")
    w("<ol style='margin-bottom: 0;'>")
    w("<li>Open the <strong>Transfer</strong> page. Send ₹500 to another user by phone number. Note the pre-lookup confirmation of the recipient's name.</li>")
    w("<li>Show that the balance updates instantaneously. Navigate to <strong>Transaction History</strong> and highlight the filter controls and <strong>CSV Export</strong>.</li>")
    w("<li>Demonstrate <strong>Bill Payments</strong> by paying a BESCOM electricity bill for ₹400. Point out the honest disclaimer stating this debits the FinLeaf account and records a simulated receipt.</li>")
    w("</ol></div>")

    w("<div class='card-box' style='margin-bottom: 8px;'>")
    w("<div class='card-box-header'>Step 3: Carbon Footprint Tracking &amp; Green Rewards (1 Minute)</div>")
    w("<ol style='margin-bottom: 0;'>")
    w("<li>Navigate to the <strong>Carbon Dashboard</strong>. Observe the calculated CO₂e footprint from the fuel and electricity payments.</li>")
    w("<li>Inspect the 6-month historical carbon trend chart and category breakdown.</li>")
    w("<li>Show the <strong>Paperless Banking</strong> counter displaying avoided sheets of paper and trees saved.</li>")
    w("<li>Open the <strong>Carbon Offset Marketplace</strong> and redeem Green Points to fund a <em>Clean Cookstove</em> or <em>Native Tree Planting</em> project.</li>")
    w("</ol></div>")

    w("<div class='card-box' style='margin-bottom: 8px;'>")
    w("<div class='card-box-header'>Step 4: Alternative Credit Scoring &amp; Micro-Loan Issuance (1 Minute)</div>")
    w("<ol style='margin-bottom: 0;'>")
    w("<li>Navigate to <strong>Profile / Trust Score</strong>. Showcase the 0–100 score and click <em>\"Why this score?\"</em> to reveal the factor contribution breakdown (+15 pts for savings, etc.).</li>")
    w("<li>Navigate to <strong>Micro-Loans</strong>. Demonstrate that loan limits and interest rates are dynamically computed from the trust score.</li>")
    w("<li>Apply for a ₹5,000 loan. Show instant disbursement into available balance and inspect the generated repayment schedule.</li>")
    w("</ol></div>")

    w("<div class='card-box'>")
    w("<div class='card-box-header'>Step 5: Literacy Quizzes, Trust Circles &amp; Administrator Console (1 Minute)</div>")
    w("<ol style='margin-bottom: 0;'>")
    w("<li>Visit the <strong>Learn</strong> section, take a 3-question quiz on fraud prevention, and demonstrate instant badge awarding.</li>")
    w("<li>Visit the <strong>Trust Circles</strong> page and demonstrate peer vouching within the village community.</li>")
    w("<li>Switch to the <strong>Administrator Console</strong> (<code>/admin</code>) to showcase live ML metrics, anomaly triage queues, and security audit logs.</li>")
    w("</ol></div>")

    w("<h2 style='margin-top: 14px;'>12.2 Academic Citations &amp; Literature References</h2>")
    w("<ul style='font-size: 8.2pt; line-height: 1.4; color: #475569;'>")
    w("<li>World Bank. <em>The Global Findex Database 2025: Connectivity and Financial Inclusion in the Digital Economy</em>. World Bank Group, July 2025.</li>")
    w("<li>Reserve Bank of India. <em>Reserve Bank of India (Digital Lending) Directions, 2025</em>. Reserve Bank of India, Mumbai, May 2025.</li>")
    w("<li>Central Electricity Authority (CEA). <em>CO₂ Baseline Database for the Indian Power Sector, Version 19.0</em>. Ministry of Power, Government of India, 2024.</li>")
    w("<li>World Resources Institute &amp; WBCSD. <em>The Greenhouse Gas Protocol: Corporate Value Chain (Scope 3) Standard (Category 3.1: Purchased Goods and Services)</em>.</li>")
    w("<li>Chen, T., &amp; Guestrin, C. (2016). <em>XGBoost: A Scalable Tree Boosting System</em>. In Proceedings of the 22nd ACM SIGKDD International Conference on Knowledge Discovery and Data Mining (pp. 785-794).</li>")
    w("<li>Liu, F. T., Ting, K. M., &amp; Zhou, Z. H. (2008). <em>Isolation Forest</em>. In 2008 Eighth IEEE International Conference on Data Mining (pp. 413-422).</li>")
    w("<li>Climatiq Technologies. <em>Climatiq Methodology Hub: Spend-Based Emission Factors</em>. https://climatiq.io/methodology.</li>")
    w("</ul>")

    w("</body>")
    w("</html>")

print("Generated /tmp/finleaf_dossier.html")
pdf_dest = os.path.join(WORKSPACE, "FinLeaf_Technical_Report_and_Feature_Guide.pdf")

res = subprocess.run([
    "chromium",
    "--headless",
    "--disable-gpu",
    "--no-sandbox",
    "--print-to-pdf-no-header",
    f"--print-to-pdf={pdf_dest}",
    "/tmp/finleaf_dossier.html"
], capture_output=True, text=True)

print("Chromium exit code:", res.returncode)
print("Chromium stderr:", res.stderr)
