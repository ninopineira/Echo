import type { CatalogReport, LevelReport } from './validate';

/** Rapport texte d'un niveau ; `verbose` ajoute la grille avec le plus court chemin tracé en « : ». */
export function formatLevelReport(report: LevelReport, verbose: boolean): string {
  const errors = report.diagnostics.filter((d) => d.severity === 'error').length;
  const s = report.stats;
  const head = errors > 0 ? 'ERREUR' : 'ok    ';
  const size = s ? ` ${s.width}×${s.height}` : '';
  const path =
    s && s.pathLength !== null
      ? ` — chemin ${s.pathLength} cases, par ${s.par ?? '?'} (suggestion ${s.parSuggestion ?? '?'}), ${s.pearls} perle(s)`
      : '';
  const out = [`${head} ${report.id}${size}${path}`];
  for (const d of report.diagnostics) {
    out.push(`       ${d.code} ${d.severity === 'error' ? 'erreur' : 'avertissement'} : ${d.message}`);
  }
  if (verbose && s) {
    const onPath = new Set(s.path.slice(1, -1));
    out.push('');
    report.lines.forEach((line, y) => {
      let row = '';
      for (let x = 0; x < line.length; x++) {
        const ch = line[x]!;
        row += onPath.has(y * s.width + x) && ch === '.' ? ':' : ch;
      }
      out.push(`    ${row}`);
    });
    out.push('');
  }
  return out.join('\n');
}

export function formatCatalogReport(report: CatalogReport, verboseId: string | null): string {
  const parts = report.reports.map((r) =>
    formatLevelReport(r, verboseId !== null && (verboseId === r.id || verboseId === 'all')),
  );
  for (const d of report.catalog) parts.push(`ERREUR catalogue — ${d.code} : ${d.message}`);
  const all = [...report.catalog, ...report.reports.flatMap((r) => r.diagnostics)];
  const errors = all.filter((d) => d.severity === 'error').length;
  const warnings = all.length - errors;
  parts.push('');
  parts.push(
    `${report.reports.length} niveau(x), ${errors} erreur(s), ${warnings} avertissement(s).`,
  );
  return parts.join('\n');
}
