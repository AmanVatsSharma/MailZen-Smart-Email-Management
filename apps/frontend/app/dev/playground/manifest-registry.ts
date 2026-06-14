import { buttonManifest } from './manifests/button.manifest';
import { dataTableManifest } from './manifests/data-table.manifest';
import { emptyStateManifest } from './manifests/empty-state.manifest';
import { skeletonManifest } from './manifests/skeleton.manifest';
import { fieldManifest } from './manifests/field.manifest';
import { statCardManifest } from './manifests/stat-card.manifest';
import { progressRingManifest } from './manifests/progress-ring.manifest';
import { metricTileManifest } from './manifests/metric-tile.manifest';
import { toastManifest } from './manifests/toast.manifest';
import { confirmDialogManifest } from './manifests/confirm-dialog.manifest';
import { dataViewManifest } from './manifests/data-view.manifest';
import { commandPaletteManifest } from './manifests/command-palette.manifest';

export const MANIFESTS = [
  buttonManifest,
  skeletonManifest,
  fieldManifest,
  emptyStateManifest,
  dataViewManifest,
  dataTableManifest,
  commandPaletteManifest,
  statCardManifest,
  progressRingManifest,
  metricTileManifest,
  confirmDialogManifest,
  toastManifest,
] as const;
