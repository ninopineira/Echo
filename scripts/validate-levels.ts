// Point d'entrée CLI du validateur de niveaux (docs/LEVEL_FORMAT.md § 6).
// Usage : npm run validate-levels [-- --verbose <slug|all>]
import { LEVEL_CATALOG } from '../src/data/levels/index';
import { LEVELS, TUNING } from '../src/data/tuning';
import { formatCatalogReport } from '../src/sim/validate/report';
import { isValid, validateCatalog } from '../src/sim/validate/validate';

const args = process.argv.slice(2);
const verboseAt = args.indexOf('--verbose');
const verboseId = verboseAt >= 0 ? (args[verboseAt + 1] ?? 'all') : null;

const report = validateCatalog(LEVEL_CATALOG, LEVELS, TUNING);
console.log(formatCatalogReport(report, verboseId));
if (!isValid(report)) process.exitCode = 1;
