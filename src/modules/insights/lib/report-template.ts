import type { AnalysisResult, FollowUpContact, DoNotFollowUpContact } from './claude'
import type { AnalysisConfig } from './data'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReportMeta {
  respondentCount: number
  silentCount: number
  pipelineId: string
  pipelineName: string
  generatedAt: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatDateFr(isoString: string): string {
  try {
    return new Date(isoString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return isoString
  }
}

function trait(text: string): string {
  return `<div class="trait"><span class="trait-dot"></span><span class="trait-text">${escapeHtml(text)}</span></div>`
}

function tag(t: string): string {
  return `<span class="tag">${escapeHtml(t)}</span>`
}

function typeBar(typeName: string, pct: number): string {
  const w = Math.max(1, Math.min(100, pct))
  return `
      <div class="bar-row">
        <span class="bar-label">${escapeHtml(typeName)}</span>
        <div class="bar-track">
          <div class="bar" style="width:${w}%;background:#1F6B4A">
            <span class="bar-val" style="color:#D1EDDF">${pct}%</span>
          </div>
        </div>
      </div>`
}

function followUpCard(contact: FollowUpContact, badgeClass: string, badgeLabel: string): string {
  const tagsHtml = contact.tags.length > 0
    ? `<div class="tags">${contact.tags.map(tag).join('')}</div>`
    : ''
  const angleHtml = contact.specific_angle
    ? `<div class="specific-angle">${escapeHtml(contact.specific_angle)}</div>`
    : ''
  return `
      <div class="contact-card">
        <div class="card-aside">
          <span class="badge ${escapeHtml(badgeClass)}">${escapeHtml(badgeLabel)}</span>
          <span class="score-chip">${contact.score}</span>
        </div>
        <div>
          <div class="contact-reason">${escapeHtml(contact.reason)}</div>
          ${angleHtml}
          ${tagsHtml}
        </div>
      </div>`
}

function dnfCard(contact: DoNotFollowUpContact): string {
  return `
      <div class="contact-card contact-card--dnf">
        <span class="badge badge-dnf">✕</span>
        <div class="contact-reason">${escapeHtml(contact.reason)}</div>
      </div>`
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function generateReportHtml(
  result: AnalysisResult,
  config: AnalysisConfig,
  meta: ReportMeta,
): string {
  const { respondentCount, silentCount, pipelineName, generatedAt } = meta
  const total = respondentCount + silentCount
  const responseRate = total > 0 ? Math.round((respondentCount / total) * 100) : 0
  const dateFr = formatDateFr(generatedAt)

  const p1 = result.to_follow_up.filter(c => c.priority === 1)
  const p2 = result.to_follow_up.filter(c => c.priority === 2)
  const p3 = result.to_follow_up.filter(c => c.priority >= 3)

  const p1Count = p1.length
  const p2Count = p2.length
  const p3Count = p3.length + result.do_not_follow_up.length

  const typeBreakdownBars = result.respondent_profile.type_breakdown
    .map(({ type, pct }) => typeBar(type, pct))
    .join('')

  const keyTraits = result.respondent_profile.key_traits.map(trait).join('')

  const p1Cards = p1.map(c => followUpCard(c, 'badge-p1', 'P1')).join('')
  const p2Cards = p2.map(c => followUpCard(c, 'badge-p2', 'P2')).join('')
  const p3Cards = [
    ...p3.map(c => followUpCard(c, 'badge-p3', 'Bas')),
    ...result.do_not_follow_up.map(dnfCard),
  ].join('')

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Analyse Pipeline — ${escapeHtml(pipelineName)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=Plus+Jakarta+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
  :root {
    --cream: #F5F1EA;
    --cream-dark: #EDE8DF;
    --ink: #1C1917;
    --ink-muted: #57534E;
    --ink-faint: #A8A29E;
    --forest: #1F6B4A;
    --forest-light: #D1EDDF;
    --forest-mid: #2E8A5F;
    --ocean: #1A4A7A;
    --ocean-light: #DBE8F6;
    --slate: #4A5568;
    --slate-light: #E8EDF4;
    --border: rgba(28,25,23,0.1);
    --border-strong: rgba(28,25,23,0.18);
    --font-display: 'Cormorant Garamond', Georgia, serif;
    --font-body: 'Plus Jakarta Sans', system-ui, sans-serif;
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: var(--font-body);
    background: var(--cream);
    color: var(--ink);
    font-size: 15px;
    line-height: 1.65;
    -webkit-font-smoothing: antialiased;
  }

  /* ── Header ── */
  .header {
    background: var(--ink);
    color: white;
    padding: 3rem 4rem 2.5rem;
    position: relative;
    overflow: hidden;
  }
  .header::before {
    content: '';
    position: absolute;
    right: -60px; top: -60px;
    width: 300px; height: 300px;
    border-radius: 50%;
    background: rgba(31,107,74,0.25);
  }
  .header::after {
    content: '';
    position: absolute;
    right: 80px; bottom: -80px;
    width: 200px; height: 200px;
    border-radius: 50%;
    background: rgba(31,107,74,0.12);
  }
  .header-eyebrow {
    font-family: var(--font-body);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: .12em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.5);
    margin-bottom: .6rem;
  }
  .header h1 {
    font-family: var(--font-display);
    font-size: 2.6rem;
    font-weight: 300;
    line-height: 1.2;
    letter-spacing: -.01em;
    position: relative;
  }
  .header h1 em {
    font-style: italic;
    color: #7AC9A0;
  }
  .header-meta {
    display: flex;
    gap: 2rem;
    margin-top: 1.8rem;
    padding-top: 1.5rem;
    border-top: 1px solid rgba(255,255,255,0.12);
    position: relative;
  }
  .meta-label {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: .1em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.4);
    display: block;
    margin-bottom: 2px;
  }
  .meta-value {
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 500;
    color: rgba(255,255,255,0.85);
  }

  /* ── Layout ── */
  .container {
    max-width: 920px;
    margin: 0 auto;
    padding: 3rem 2rem;
  }

  /* ── Section ── */
  .section { margin-bottom: 3.5rem; }
  .section-header {
    display: flex;
    align-items: baseline;
    gap: 1rem;
    margin-bottom: 1.5rem;
    padding-bottom: .75rem;
    border-bottom: 1px solid var(--border);
  }
  .section-number {
    font-family: var(--font-display);
    font-size: 1.4rem;
    font-weight: 300;
    font-style: italic;
    color: var(--forest);
    opacity: .6;
    flex-shrink: 0;
    line-height: 1;
    margin-top: 2px;
  }
  .section-title {
    font-family: var(--font-display);
    font-size: 1.45rem;
    font-weight: 500;
    letter-spacing: -.01em;
    line-height: 1.2;
  }

  /* ── Metrics ── */
  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1px;
    background: var(--border);
    border: 1px solid var(--border);
    border-radius: 12px;
    overflow: hidden;
  }
  .metric-cell {
    background: white;
    padding: 1.4rem 1.3rem;
  }
  .metric-cell:first-child { border-radius: 11px 0 0 11px; }
  .metric-cell:last-child  { border-radius: 0 11px 11px 0; }
  .metric-label {
    font-size: 10.5px;
    font-weight: 600;
    letter-spacing: .08em;
    text-transform: uppercase;
    color: var(--ink-faint);
    display: block;
    margin-bottom: .4rem;
  }
  .metric-value {
    font-family: var(--font-display);
    font-size: 2.5rem;
    font-weight: 300;
    line-height: 1;
    color: var(--ink);
  }
  .metric-sub {
    font-size: 12px;
    color: var(--ink-muted);
    margin-top: .35rem;
  }
  .metric-cell.accent .metric-value { color: var(--forest); }

  /* ── Chart bars ── */
  .chart-box {
    background: white;
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 1.8rem 2rem;
  }
  .chart-legend {
    display: flex;
    gap: 1.5rem;
    margin-bottom: 1.4rem;
    font-size: 12px;
    color: var(--ink-muted);
    font-weight: 500;
  }
  .legend-dot {
    width: 10px; height: 10px;
    border-radius: 2px;
    display: inline-block;
    margin-right: 5px;
    vertical-align: middle;
  }
  .bar-row {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 12px;
  }
  .bar-label {
    font-size: 12px;
    font-weight: 500;
    color: var(--ink-muted);
    width: 160px;
    text-align: right;
    flex-shrink: 0;
  }
  .bar-track { flex: 1; display: flex; gap: 4px; align-items: center; }
  .bar {
    height: 22px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding-right: 7px;
    transition: opacity .2s;
    min-width: 28px;
  }
  .bar:hover { opacity: .85; }
  .bar-val { font-size: 11px; font-weight: 600; }

  /* ── Insight box ── */
  .insight {
    background: var(--forest-light);
    border-left: 3px solid var(--forest);
    border-radius: 0 8px 8px 0;
    padding: 1rem 1.25rem;
    margin-bottom: 1.25rem;
    font-size: 13.5px;
    color: #1A4A35;
    line-height: 1.6;
  }
  .insight strong { font-weight: 600; }
  .insight:last-child { margin-bottom: 0; }

  /* ── Profile Pattern ── */
  .profile-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-bottom: 1.25rem;
  }
  .profile-card {
    background: white;
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 1.2rem 1.4rem;
  }
  .profile-card--dominant {
    background: var(--forest-light);
    border-color: rgba(31,107,74,0.2);
  }
  .profile-card-title {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: .08em;
    text-transform: uppercase;
    color: var(--ink-faint);
    margin-bottom: .75rem;
  }
  .dominant-type {
    font-family: var(--font-display);
    font-size: 1.75rem;
    font-weight: 400;
    font-style: italic;
    color: var(--forest);
    line-height: 1.25;
  }
  .trait {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 6px;
    font-size: 13px;
  }
  .trait-dot {
    width: 5px; height: 5px;
    border-radius: 50%;
    background: var(--forest);
    flex-shrink: 0;
    margin-top: 5px;
  }
  .trait-text { color: var(--ink-muted); line-height: 1.5; }
  .trait-text strong { color: var(--ink); font-weight: 600; }

  /* ── Tabs ── */
  .tab-nav {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 1.25rem;
    background: var(--cream-dark);
    padding: 4px;
    border-radius: 10px;
  }
  .tab-btn {
    padding: 7px 18px;
    border-radius: 7px;
    border: none;
    background: transparent;
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 500;
    color: var(--ink-muted);
    cursor: pointer;
    transition: all .18s;
    display: flex;
    align-items: center;
    gap: 7px;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .tab-btn.active {
    background: white;
    color: var(--ink);
    box-shadow: 0 1px 4px rgba(0,0,0,.1);
  }
  .tab-dot {
    width: 7px; height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .panel { display: none; }
  .panel.active { display: block; }

  /* ── Contact Cards ── */
  .contact-card {
    background: white;
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 1.25rem 1.5rem;
    margin-bottom: .75rem;
    display: flex;
    gap: 1.1rem;
    align-items: flex-start;
    transition: box-shadow .2s, border-color .2s;
    animation: fadeUp .3s ease both;
  }
  .contact-card:hover {
    border-color: var(--border-strong);
    box-shadow: 0 4px 16px rgba(0,0,0,.06);
  }
  .contact-card--dnf {
    background: #FFFBFB;
    border-color: rgba(153,27,27,0.12);
  }
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .contact-card:nth-child(1) { animation-delay: .05s; }
  .contact-card:nth-child(2) { animation-delay: .10s; }
  .contact-card:nth-child(3) { animation-delay: .15s; }
  .contact-card:nth-child(4) { animation-delay: .20s; }
  .contact-card:nth-child(5) { animation-delay: .25s; }

  .card-aside {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
    padding-top: 2px;
  }
  .badge {
    padding: 4px 11px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: .04em;
    text-transform: uppercase;
    white-space: nowrap;
  }
  .badge-p1  { background: var(--forest-light); color: #1B5E3A; }
  .badge-p2  { background: var(--ocean-light);  color: var(--ocean); }
  .badge-p3  { background: var(--cream-dark);   color: var(--ink-muted); }
  .badge-dnf { background: #FEE2E2;             color: #991B1B; }

  .score-chip {
    font-size: 11px;
    font-weight: 700;
    color: var(--ink-muted);
    background: var(--cream-dark);
    border-radius: 20px;
    padding: 2px 8px;
    white-space: nowrap;
  }
  .contact-reason {
    font-size: 13px;
    color: var(--ink-muted);
    line-height: 1.65;
  }
  .specific-angle {
    margin-top: .5rem;
    font-size: 12.5px;
    color: var(--forest-mid);
    font-style: italic;
    line-height: 1.55;
  }
  .tags {
    margin-top: .6rem;
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }
  .tag {
    font-size: 11px;
    font-weight: 500;
    background: var(--cream);
    border: 1px solid var(--border);
    color: var(--ink-muted);
    padding: 2px 9px;
    border-radius: 20px;
  }

  /* ── Warning box ── */
  .warning-box {
    background: #FEF3CD;
    border-left: 3px solid #D97706;
    border-radius: 0 8px 8px 0;
    padding: 1rem 1.25rem;
    font-size: 13px;
    color: #78350F;
    line-height: 1.6;
    margin-bottom: 1.25rem;
  }

  /* ── Conclusion ── */
  .conclusion-box {
    background: var(--ink);
    color: white;
    border-radius: 14px;
    padding: 2rem 2.5rem;
    position: relative;
    overflow: hidden;
  }
  .conclusion-box::before {
    content: '';
    position: absolute;
    right: -40px; top: -40px;
    width: 180px; height: 180px;
    border-radius: 50%;
    background: rgba(31,107,74,0.2);
  }
  .conclusion-box h3 {
    font-family: var(--font-display);
    font-size: 1.3rem;
    font-weight: 400;
    font-style: italic;
    color: #7AC9A0;
    margin-bottom: .5rem;
    position: relative;
  }
  .conclusion-box p {
    font-size: 14px;
    line-height: 1.7;
    color: rgba(255,255,255,0.8);
    position: relative;
  }
  .conclusion-box strong { color: white; }

  /* ── Footer ── */
  .footer {
    text-align: center;
    padding: 2rem;
    font-size: 12px;
    color: var(--ink-faint);
    border-top: 1px solid var(--border);
    margin-top: 1rem;
  }

  @media (max-width: 700px) {
    .header { padding: 2rem 1.5rem; }
    .header h1 { font-size: 1.9rem; }
    .header-meta { flex-wrap: wrap; gap: 1rem; }
    .container { padding: 2rem 1rem; }
    .metrics-grid { grid-template-columns: 1fr 1fr; }
    .profile-grid { grid-template-columns: 1fr; }
    .bar-label { width: 100px; }
  }
</style>
</head>
<body>

<!-- ══ HEADER ══ -->
<div class="header">
  <p class="header-eyebrow">Rapport d'analyse · Pipeline ${escapeHtml(pipelineName)}</p>
  <h1>Analyse des <em>profils répondants</em><br>et stratégie de relance</h1>
  <div class="header-meta">
    <div class="meta-item">
      <span class="meta-label">Date d'analyse</span>
      <span class="meta-value">${escapeHtml(dateFr)}</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">Répondants</span>
      <span class="meta-value">${respondentCount} contact${respondentCount > 1 ? 's' : ''}</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">Silencieux</span>
      <span class="meta-value">${silentCount} contact${silentCount > 1 ? 's' : ''}</span>
    </div>
  </div>
</div>

<!-- ══ MAIN CONTENT ══ -->
<div class="container">

  <!-- 01 · Vue d'ensemble -->
  <div class="section">
    <div class="section-header">
      <span class="section-number">01</span>
      <h2 class="section-title">Vue d'ensemble du pipeline</h2>
    </div>
    <div class="metrics-grid">
      <div class="metric-cell">
        <span class="metric-label">Sollicitations sans réponse</span>
        <div class="metric-value">${silentCount}</div>
        <div class="metric-sub">contacts silencieux</div>
      </div>
      <div class="metric-cell accent">
        <span class="metric-label">Contacts engagés</span>
        <div class="metric-value">${respondentCount}</div>
        <div class="metric-sub">ont répondu positivement</div>
      </div>
      <div class="metric-cell accent">
        <span class="metric-label">Taux de réponse</span>
        <div class="metric-value">${responseRate}%</div>
        <div class="metric-sub">sur l'ensemble des sollicités</div>
      </div>
      <div class="metric-cell">
        <span class="metric-label">À ne pas relancer</span>
        <div class="metric-value">${result.do_not_follow_up.length}</div>
        <div class="metric-sub">refus ou hors-cible identifiés</div>
      </div>
    </div>
  </div>

  <!-- 02 · Profil des répondants -->
  <div class="section">
    <div class="section-header">
      <span class="section-number">02</span>
      <h2 class="section-title">Profil type des contacts répondants</h2>
    </div>
    <div class="profile-grid">
      <div class="profile-card profile-card--dominant">
        <div class="profile-card-title">Type dominant</div>
        <div class="dominant-type">${escapeHtml(result.respondent_profile.dominant_type)}</div>
      </div>
      <div class="profile-card">
        <div class="profile-card-title">Caractéristiques communes</div>
        ${keyTraits}
      </div>
    </div>
    <div class="insight">${escapeHtml(result.respondent_profile.insight)}</div>
  </div>

  <!-- 03 · Répartition par type -->
  <div class="section">
    <div class="section-header">
      <span class="section-number">03</span>
      <h2 class="section-title">Répartition par type — profil répondants</h2>
    </div>
    <div class="chart-box">
      <div class="chart-legend">
        <span><span class="legend-dot" style="background:#1F6B4A"></span>Répondants (${respondentCount} contact${respondentCount > 1 ? 's' : ''})</span>
      </div>
      ${typeBreakdownBars}
    </div>
  </div>

  <!-- 04 · Contacts à relancer -->
  <div class="section">
    <div class="section-header">
      <span class="section-number">04</span>
      <h2 class="section-title">Contacts à relancer parmi les silencieux</h2>
    </div>

    <div class="tab-nav">
      <button class="tab-btn active" onclick="showTab('t1',this)">
        <span class="tab-dot" style="background:#1F6B4A"></span>Priorité 1 — Relancer
        ${p1Count > 0 ? `<span class="score-chip" style="background:#D1EDDF;color:#1B5E3A">${p1Count}</span>` : ''}
      </button>
      <button class="tab-btn" onclick="showTab('t2',this)">
        <span class="tab-dot" style="background:#1A4A7A"></span>Priorité 2 — Intéressant
        ${p2Count > 0 ? `<span class="score-chip" style="background:#DBE8F6;color:#1A4A7A">${p2Count}</span>` : ''}
      </button>
      <button class="tab-btn" onclick="showTab('t3',this)">
        <span class="tab-dot" style="background:#A8A29E"></span>Déprioritiser
        ${p3Count > 0 ? `<span class="score-chip">${p3Count}</span>` : ''}
      </button>
    </div>

    <div id="t1" class="panel active">
      ${p1Cards || '<p style="color:var(--ink-faint);font-size:13px;padding:.5rem 0">Aucun contact en priorité 1.</p>'}
    </div>

    <div id="t2" class="panel">
      <div class="insight" style="background:#DBE8F6;border-left-color:#1A4A7A;color:#1A3555">
        Ces contacts présentent des caractéristiques <strong>partiellement alignées</strong>. Relance justifiée mais le message doit être davantage personnalisé à leur angle spécifique.
      </div>
      ${p2Cards || '<p style="color:var(--ink-faint);font-size:13px;padding:.5rem 0">Aucun contact en priorité 2.</p>'}
    </div>

    <div id="t3" class="panel">
      <div class="warning-box">
        Ces contacts ont un profil <strong>significativement différent</strong> des répondants, ou ont explicitement refusé. Le silence ou le refus n'est probablement pas conjoncturel. Ne pas relancer sans retravailler l'angle ou qualifier une opportunité spécifique.
      </div>
      ${p3Cards || '<p style="color:var(--ink-faint);font-size:13px;padding:.5rem 0">Aucun contact dans cette catégorie.</p>'}
    </div>
  </div>

  <!-- 05 · Conclusion -->
  <div class="section">
    <div class="section-header">
      <span class="section-number">05</span>
      <h2 class="section-title">Synthèse stratégique</h2>
    </div>
    <div class="conclusion-box">
      <h3>L'essentiel à retenir</h3>
      <p>${escapeHtml(result.key_insight)}</p>
    </div>
  </div>

</div>

<!-- ══ FOOTER ══ -->
<div class="footer">
  Analyse générée via PipeLeads · ${escapeHtml(dateFr)} · Pipeline ${escapeHtml(pipelineName)}
</div>

<script>
  function showTab(id, btn) {
    document.querySelectorAll('.panel').forEach(function(p) { p.classList.remove('active'); });
    document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
    document.getElementById(id).classList.add('active');
    btn.classList.add('active');
  }
</script>
</body>
</html>`
}
