import { nbDeep } from './helpers';
export type PillarSlug = 'guard' | 'inspect' | 'flow' | 'sense' | 'infra';

export interface Pillar {
  slug: PillarSlug;
  name: string;
  area: string;
  color: string; // CSS var reference
  hex: string;
  short: string;
  /** Meta description for the pillar page (at most ~155 characters). */
  meta: string;
  headline: string;
  intro: string;
  scene: string;
  photo: string;
  video: string;
  sceneCaption: string;
  gaps: { problem: string; fix: string }[];
  capabilities: string[];
  buyers: string[];
}

export const pillars: Pillar[] = nbDeep<Pillar[]>([
  {
    slug: 'guard',
    photo: 'ppe-site-workers',
    video: 'v-workers-ppe',
    name: 'Glance Guard',
    area: 'Industrial safety',
    color: 'var(--guard)',
    hex: '#f59e0b',
    short: 'PPE worn correctly, danger zones, vehicles, work at height, fire and permits.',
    meta: 'Glance Guard turns existing CCTV into a safety system: PPE worn correctly, danger zones, vehicles, work at height, fire watch and permits to work.',
    headline: 'Safety that understands context, not just objects.',
    intro:
      'Guard turns existing CCTV into a safety system that checks whether the rule for this zone, this task and this permit is actually being followed — then warns people at the point of work, not in tomorrow’s report.',
    scene: 'guard-zone',
    sceneCaption: 'Hazard zones, tracked workers and live breach alerts.',
    gaps: [
      { problem: 'Detectors confirm a helmet is in frame, not that it is worn correctly.', fix: 'Worn-state checks map each PPE item to the right body keypoint — helmet on head, goggles over eyes, mask over nose.' },
      { problem: 'The same PPE rule is applied everywhere.', fix: 'A PPE matrix of zone × shift × task × permit, so hot work and confined-space entries get the right checks.' },
      { problem: 'One violation fires dozens of frame-level alerts.', fix: 'One violation becomes one event with duration and severity, de-duplicated and escalated only if it persists.' },
      { problem: 'Harness present is not harness tied off.', fix: 'At-height detection plus hook-to-lifeline reasoning, with optional smart-hook sensor fusion.' },
      { problem: 'Dashboards report after the fact.', fix: 'Point-of-work nudges via speaker, strobe or LED sign — without naming individuals.' },
    ],
    capabilities: ['Worn-state PPE detection', 'Zone & machine guarding', 'Vehicle–pedestrian proximity', 'Work-at-height & tie-off', 'Smoke, flame & hot-work fire watch', 'Permit-to-work verification', 'Man-down & lone worker', 'Ergonomic risk (aggregate)'],
    buyers: ['EHS / HSE heads', 'Plant & site heads', 'Construction project directors'],
  },
  {
    slug: 'inspect',
    photo: 'quality-inspector',
    video: 'v-inspection-line',
    name: 'Glance Inspect',
    area: 'Product quality',
    color: 'var(--inspect)',
    hex: '#22d3ee',
    short: 'Surface defects, colour anomalies, assembly, packaging and measurement.',
    meta: 'Glance Inspect finds surface defects, measures colour difference (ΔE) and checks assembly, labels and dimensions at line speed, trained on good parts.',
    headline: 'See every defect — and every shade — before it ships.',
    intro:
      'Inspect learns from good parts only, measures colour difference against your master sample under calibrated light, and turns anomaly scores into pass / review / reject decisions your line can act on.',
    scene: 'defect-part',
    sceneCaption: 'Laser-scan reveal of an anomaly heatmap on a machined part.',
    gaps: [
      { problem: 'Rule-based machine vision needs specialist programmers for every change.', fix: 'Train on 50–200 good images, no code, with SKU recipes for changeovers in minutes.' },
      { problem: 'Colour checks drift with factory lighting.', fix: 'Controlled D65 lighting, per-shift reference-card calibration, ΔE2000 against the master and drift alarms.' },
      { problem: 'Patch-based anomaly models miss missing parts and wrong counts.', fix: 'Hybrid pipeline: component segmentation, count and position rules, plus visual reasoning.' },
      { problem: 'A heatmap is not a decision.', fix: 'Cost-weighted pass / review / reject per SKU, with the nearest good example shown as evidence.' },
      { problem: 'Defect data stays on one inspection PC.', fix: 'Plant-wide analytics that link defect spikes to machine parameters, shift, batch and supplier lot.' },
    ],
    capabilities: ['Surface defect detection', 'Colour & shade anomaly (ΔE)', 'Shade sorting', 'Assembly verification', 'Label, code & seal inspection', 'Dimensional measurement', 'Line-scan web inspection', 'Grading & sorting'],
    buyers: ['Quality heads', 'Production managers', 'Process engineers'],
  },
  {
    slug: 'flow',
    photo: 'packaging-line',
    video: 'v-bulk-conveyor',
    name: 'Glance Flow',
    area: 'Conveyors & line flow',
    color: 'var(--flow)',
    hex: '#3b82f6',
    short: 'Belt health for bulk conveyors, jams and micro-stops on production lines, gates and yards.',
    meta: 'Glance Flow watches bulk conveyors for rips, drift and spillage, and production lines for jams and micro-stops, with video fused with PLC signals.',
    headline: 'One camera watching what used to need ten sensors.',
    intro:
      'Flow monitors bulk-material conveyors for rips, drift, spillage, blockages and hot idlers, and production lines for jams, gaps, fallen products and the micro-stops nobody logs.',
    scene: 'belt-flow',
    sceneCaption: 'Bulk conveyor with material stream, thermal idler alert and drift tracking.',
    gaps: [
      { problem: 'Each conveyor failure mode needs its own point sensor.', fix: 'One vision unit covering rip, drift, spillage, blockage and foreign objects together.' },
      { problem: 'Micro-stops under two minutes are never logged.', fix: 'Automatic stop detection feeding a true OEE picture by station and shift.' },
      { problem: 'Video cannot tell if a conveyor should be running.', fix: 'Fusion with PLC / SCADA signals: motor on + no movement = jam.' },
    ],
    capabilities: ['Belt rip & edge damage', 'Belt misalignment', 'Spillage & chute blockage', 'Hot idler detection (thermal)', 'Foreign object detection', 'Jam & pile-up detection', 'Micro-stop & OEE analytics', 'Gate, plate & container reading'],
    buyers: ['Maintenance & reliability heads', 'Operations managers', 'Logistics managers'],
  },
  {
    slug: 'sense',
    photo: 'pipe-rack',
    video: 'v-refinery-night',
    name: 'Glance Sense',
    area: 'Plant condition',
    color: 'var(--sense)',
    hex: '#2dd4bf',
    short: 'Leaks, spills, steam, housekeeping, thermal hot spots and analog gauge reading.',
    meta: 'Glance Sense learns what normal looks like for each camera and flags leaks, spills, steam and hot spots. It also reads analog gauges.',
    headline: 'Your plant’s baseline — and every deviation from it.',
    intro:
      'Sense learns what normal looks like for every camera, by shift and time of day, and flags leaks, vapour, spills, blocked walkways and hot spots. It also reads the analog gauges your operators still walk past on rounds.',
    scene: 'sense-scene',
    sceneCaption: 'Pipe rack with vapour leak, gauge reading and thermal hot spot.',
    gaps: [
      { problem: 'Industrial anomaly tools focus on products, not the plant around them.', fix: 'Scene-level anomaly baselines per camera, aware of shift and time of day.' },
      { problem: 'Lab-grade accuracy degrades on the floor as light and viewpoint change.', fix: 'Per-camera drift monitoring and automatic refresh of the normal baseline.' },
      { problem: 'Brownfield plants have hundreds of analog gauges and no sensors.', fix: 'Gauge and meter reading from existing cameras, with trends and limit alarms.' },
    ],
    capabilities: ['Leak, spill & vapour detection', 'Housekeeping / 5S scoring', 'Blocked exits & walkways', 'Thermal hot-spot monitoring', 'Analog gauge reading', 'Vision + PLC fusion', 'Gas imaging integration (partner)'],
    buyers: ['Maintenance heads', 'Reliability engineers', 'Plant managers'],
  },
  {
    slug: 'infra',
    photo: 'concrete-crack',
    video: 'v-bridge-aerial',
    name: 'Glance Infra',
    area: 'Infrastructure assets',
    color: 'var(--infra)',
    hex: '#22c55e',
    short: 'Bridges, tunnels and power assets inspected from drones and fixed cameras; road and rail surveys on the roadmap.',
    meta: 'Glance Infra measures cracks, spalling and corrosion on bridges and power assets from drone surveys. Early access; road and rail are on the roadmap.',
    headline: 'Condition intelligence for the assets a country runs on.',
    intro:
      'Infra detects and measures cracks, spalling, corrosion and distress on civil and utility assets, tracks change over time, and produces inspection reports that are reviewed and signed by qualified engineers.',
    scene: 'infra-bridge',
    sceneCaption: 'Drone survey of a truss bridge with crack detection and width labels.',
    gaps: [
      { problem: 'Manual inspection is slow, risky and inconsistent between inspectors.', fix: 'Drone capture with consistent AI detection and measured crack widths.' },
      { problem: 'Findings live in PDFs that cannot be compared year to year.', fix: 'Geo-referenced change detection on every structure, linked to GIS and BIM.' },
      { problem: 'AI output alone is not accepted for asset decisions.', fix: 'Every report is reviewed and signed by a qualified structural or electrical engineer.' },
    ],
    // Early-access capabilities first: the home pillar card shows only the first four.
    capabilities: ['Crack, spalling & corrosion detection', 'Crack width measurement', 'Power line & substation inspection', 'Solar hot-spot surveys', 'Pavement distress mapping', 'Rail fastener & surface defects', 'Construction progress vs BIM'],
    buyers: ['Asset owners & authorities', 'EPC contractors', 'Utilities', 'Rail & metro operators'],
  },
]);

export const pillarBySlug = Object.fromEntries(pillars.map((p) => [p.slug, p])) as Record<PillarSlug, Pillar>;
