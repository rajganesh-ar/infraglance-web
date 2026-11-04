import type { PillarSlug } from './pillars';
import type { IndustrySlug } from './industries';
import { nbDeep } from './helpers';

export interface Product {
  slug: string;
  pillar: PillarSlug;
  name: string;
  tagline: string;
  summary: string;
  detects: string[];
  how: string[];
  deploy: string[];
  integrations: string[];
  industries: IndustrySlug[];
  phase: 'Available' | 'Early access' | 'Roadmap';
}

const EDGE = 'Glance Edge box on site (works offline)';
const CCTV = 'Existing IP cameras (RTSP / ONVIF)';
const EHS = ['EHS software', 'Microsoft Teams / WhatsApp / SMS alerts', 'Sirens & strobes via I/O relay', 'Webhooks & REST API'];
const MES = ['PLC (OPC-UA, Modbus, Profinet via gateway)', 'MES / ERP', 'Reject actuators (air jet, pusher, diverter)', 'QMS'];
const CMMS = ['SAP PM / IBM Maximo work orders', 'SCADA / historian', 'Webhooks & REST API'];

export const products: Product[] = nbDeep<Product[]>([
  // ---------------- GUARD ----------------
  {
    slug: 'guard-ppe', pillar: 'guard', name: 'Guard PPE+', phase: 'Available',
    tagline: 'PPE worn correctly — for the zone, the task and the permit.',
    summary: 'Checks that helmets, vests, gloves, goggles, masks, ear protection and harnesses are worn correctly. Required PPE is set per zone, shift and task.',
    detects: ['Helmet on head vs. carried, chin strap state', 'Hi-vis vest present and fastened', 'Gloves, goggles, face shields, masks over nose', 'Ear protection in noise zones', 'Task-specific PPE (e.g. welding arc → face shield)'],
    how: ['Person detection and multi-object tracking', 'High-resolution crop per person, per-item classifier', 'Keypoint mapping of each item to the right body part', 'Track-level voting over several seconds, not single frames', 'Rule evaluation against the PPE matrix'],
    deploy: [CCTV, EDGE, 'Optional PTZ zoom-on-trigger'], integrations: EHS,
    industries: ['manufacturing', 'heavy-industry', 'construction', 'energy-utilities', 'logistics'],
  },
  {
    slug: 'guard-zone', pillar: 'guard', name: 'Guard Zone', phase: 'Available',
    tagline: 'Danger zones that know when they are dangerous.',
    summary: 'Restricted areas around robots, presses, cranes and live equipment, armed by schedule and machine state, with lockout-tagout and confined-space checks.',
    detects: ['Zone intrusion with dwell time', 'Machine danger zones linked to machine state', 'Crane and excavator swing radius', 'Confined-space entry count and attendant presence', 'Lockout-tagout presence'],
    how: ['Zones drawn in real-world coordinates', 'Tracking across overlapping cameras', 'Machine state from PLC to arm / disarm zones', 'Severity by zone class and dwell'],
    deploy: [CCTV, EDGE], integrations: [...EHS, 'PLC interlocks (advisory)'],
    industries: ['manufacturing', 'heavy-industry', 'construction', 'energy-utilities', 'transport-infrastructure'],
  },
  {
    slug: 'guard-traffic', pillar: 'guard', name: 'Guard Traffic', phase: 'Early access',
    tagline: 'Forklifts, trucks and people — kept apart.',
    summary: 'Measures vehicle–pedestrian proximity, speeding, wrong-way driving and blind-corner risk, and counts near-misses as a leading indicator.',
    detects: ['Vehicle–pedestrian proximity events', 'Speeding in pedestrian zones', 'Wrong-way and no-go aisles', 'Blind-corner approaches', 'Near-miss frequency by aisle and shift'],
    how: ['Ground-plane calibration for real distances', 'Vehicle and person tracking', 'Time-to-collision estimation', 'Heatmaps of near-miss hot spots'],
    deploy: [CCTV, EDGE, 'Optional Glance Nudge warning beacons'], integrations: EHS,
    industries: ['logistics', 'manufacturing', 'heavy-industry', 'transport-infrastructure'],
  },
  {
    slug: 'guard-height', pillar: 'guard', name: 'Guard Height', phase: 'Early access',
    tagline: 'Harness worn is not harness tied off.',
    summary: 'Detects people working at height, checks harness and hook-to-lifeline attachment, and flags unprotected edges and unsafe scaffold or ladder use.',
    detects: ['Worker elevation above threshold', 'Harness presence', 'Hook attached to lifeline or anchor', 'Unprotected edges and openings', 'Unsafe ladder use'],
    how: ['Elevation estimation from scene geometry', 'Small-object detection for hooks and lifelines', 'Relationship reasoning between person, hook and anchor', 'Optional fusion with smart-hook IMU sensors'],
    deploy: [CCTV, 'Glance Pod for sites without CCTV', EDGE], integrations: EHS,
    industries: ['construction', 'energy-utilities', 'heavy-industry', 'transport-infrastructure'],
  },
  {
    slug: 'guard-fire', pillar: 'guard', name: 'Guard Fire', phase: 'Early access',
    tagline: 'Smoke, flame and sparks — and a fire watch that is actually watching.',
    summary: 'Early visual detection of smoke, flame and sparks, plus hot-work fire watch verification that the watcher stays for the required time.',
    detects: ['Smoke and flame', 'Sparks and hot-work activity', 'Fire watcher presence after hot work', 'Blocked fire exits and extinguishers'],
    how: ['Temporal smoke/flame models robust to steam and reflections', 'Hot-work detection from arc light', 'Timers bound to permits'],
    deploy: [CCTV, EDGE, 'Thermal cameras (optional)'], integrations: [...EHS, 'Fire alarm panel (advisory input)'],
    industries: ['manufacturing', 'heavy-industry', 'logistics', 'energy-utilities'],
  },
  {
    slug: 'guard-permit', pillar: 'guard', name: 'Guard Permit', phase: 'Roadmap',
    tagline: 'When a permit opens, the cameras check the conditions.',
    summary: 'Connects to digital permit-to-work systems and verifies barricades, PPE, extinguishers and attendants are in place before and during permitted work.',
    detects: ['Barricades and signage present', 'Required PPE for permit type', 'Fire extinguisher within reach', 'Attendant presence for confined space'],
    how: ['Permit events received from PTW system', 'Cameras auto-assigned by permit location', 'Checklist verified visually and logged to the permit'],
    deploy: [CCTV, EDGE], integrations: ['Digital permit-to-work systems', ...EHS],
    industries: ['heavy-industry', 'energy-utilities', 'manufacturing'],
  },
  {
    slug: 'guard-lone', pillar: 'guard', name: 'Guard Lone', phase: 'Early access',
    tagline: 'Man-down detected in seconds, not at the end of the shift.',
    summary: 'Detects falls, people lying motionless and lone workers in remote areas, and escalates fast.',
    detects: ['Slip, trip and fall events', 'Person motionless beyond threshold', 'Lone worker in restricted hours'],
    how: ['Pose estimation and fall classification', 'Escalation ladder with acknowledgement'],
    deploy: [CCTV, EDGE], integrations: EHS,
    industries: ['heavy-industry', 'energy-utilities', 'logistics', 'transport-infrastructure'],
  },
  {
    slug: 'guard-ergo', pillar: 'guard', name: 'Guard Ergo', phase: 'Roadmap',
    tagline: 'Ergonomic risk by workstation — never by person.',
    summary: 'Scores lifting and posture risk per workstation using pose estimation, reported in aggregate to target redesigns.',
    detects: ['High-risk lifting postures', 'Repetitive overhead reach', 'Twisting under load'],
    how: ['Pose estimation', 'REBA-style scoring', 'Aggregate per station and shift — no individual scoring'],
    deploy: [CCTV, EDGE], integrations: EHS,
    industries: ['logistics', 'manufacturing'],
  },

  // ---------------- INSPECT ----------------
  {
    slug: 'inspect-defect', pillar: 'inspect', name: 'Inspect Defect', phase: 'Available',
    tagline: 'Find the defects you have never seen before.',
    summary: 'Unsupervised anomaly detection trained on good parts only, combined with supervised models for known defect classes.',
    detects: ['Scratches, dents and cracks', 'Porosity and burrs on castings', 'Stains, burn marks and contamination', 'Short shots, flash and sink marks on mouldings'],
    how: ['Train on 50–200 good images', 'Anomaly heatmap + known-class detector', 'Cost-weighted pass / review / reject', 'Operator review feeds active learning'],
    deploy: ['Inspect Station kit or customer cameras', 'Controlled lighting', EDGE], integrations: MES,
    industries: ['manufacturing', 'heavy-industry'],
  },
  {
    slug: 'inspect-colour', pillar: 'inspect', name: 'Inspect Colour', phase: 'Available',
    tagline: 'Colour difference measured, not guessed.',
    summary: 'Measures ΔE2000 against the master sample under calibrated lighting, and catches streaks, blotches and uneven coverage that an average colour misses.',
    detects: ['ΔE deviation from master sample', 'Batch-to-batch shade variation', 'Streaks, blotches and uneven coating', 'Discolouration and wrong colour variant', 'Trending drift before failure'],
    how: ['Enclosed D65 LED lighting with locked exposure and white balance', 'Per-shift calibration on a colour reference card', 'Conversion to CIELAB and ΔE2000', 'Pattern-level anomaly model on top'],
    deploy: ['Inspect Station or Tunnel kit', EDGE, 'Optional multispectral camera / spectrophotometer link'], integrations: MES,
    industries: ['manufacturing'],
  },
  {
    slug: 'inspect-shade-sort', pillar: 'inspect', name: 'Inspect Shade Sort', phase: 'Early access',
    tagline: 'Every box, one shade.',
    summary: 'Groups tiles, fabric, leather and panels into shade lots so mismatched shades never ship together.',
    detects: ['Shade lot assignment', 'Out-of-tolerance pieces', 'Texture and pattern consistency'],
    how: ['Calibrated colour measurement', 'Clustering into shade lots', 'Sorter or label output per piece'],
    deploy: ['Inspect Station or Web kit', EDGE], integrations: MES,
    industries: ['manufacturing'],
  },
  {
    slug: 'inspect-assembly', pillar: 'inspect', name: 'Inspect Assembly', phase: 'Early access',
    tagline: 'Missing, wrong, flipped — caught at the station.',
    summary: 'Verifies presence, count, orientation and correct part, including logical anomalies that patch-based models miss.',
    detects: ['Missing components and fasteners', 'Wrong count', 'Wrong orientation', 'Wrong part variant', 'Step sequence at manual stations'],
    how: ['Component segmentation', 'Count, position and relationship rules', 'Visual reasoning as a second check'],
    deploy: ['Inspect Station Pro', EDGE], integrations: MES,
    industries: ['manufacturing'],
  },
  {
    slug: 'inspect-pack', pillar: 'inspect', name: 'Inspect Pack', phase: 'Early access',
    tagline: 'Labels, codes, caps and seals at line speed.',
    summary: 'Checks label presence and correctness, print quality, batch and expiry codes, barcodes, caps, seals, fill level and carton damage.',
    detects: ['Label presence, position and content', 'Batch / expiry OCR and verification', 'Barcode grading', 'Cap, seal and fill level', 'Carton damage'],
    how: ['Encoder-triggered capture', 'OCR / OCV models', 'Recipe per SKU'],
    deploy: ['Inspect Tunnel kit', EDGE], integrations: MES,
    industries: ['manufacturing', 'logistics'],
  },
  {
    slug: 'inspect-measure', pillar: 'inspect', name: 'Inspect Measure', phase: 'Roadmap',
    tagline: 'Dimensions, gaps and flush — validated by MSA.',
    summary: 'Non-contact measurement of dimensions, gaps, alignment and hole positions with measurement-system analysis.',
    detects: ['Length, width, diameter', 'Gap and flush', 'Hole position', 'Profile deviation (3D)'],
    how: ['Telecentric or 3D laser profiling', 'Calibration targets', 'Gauge R&R / MSA reports'],
    deploy: ['Inspect Station Pro with 3D', EDGE], integrations: MES,
    industries: ['manufacturing'],
  },
  {
    slug: 'inspect-web', pillar: 'inspect', name: 'Inspect Web', phase: 'Roadmap',
    tagline: 'Continuous materials, inspected edge to edge.',
    summary: 'Line-scan inspection of textile, paper, film, nonwovens and metal strip at full line speed.',
    detects: ['Holes, tears and slubs', 'Coating and print defects', 'Shade variation across width', 'Edge defects'],
    how: ['Line-scan camera with encoder sync', 'Defect map per roll', 'Roll report for downstream cutting'],
    deploy: ['Inspect Web kit', 'GPU edge server'], integrations: MES,
    industries: ['manufacturing', 'heavy-industry'],
  },
  {
    slug: 'inspect-grade', pillar: 'inspect', name: 'Inspect Grade', phase: 'Roadmap',
    tagline: 'Size, colour and quality grading with actuation.',
    summary: 'Grades and sorts agricultural and food products by size, colour, ripeness and defects.',
    detects: ['Size and shape', 'Colour and ripeness', 'Bruising and blemishes', 'Foreign material'],
    how: ['Multi-view capture on rollers or belt', 'Per-item grade', 'Ejector timing'],
    deploy: ['Inspect Station or Tunnel', EDGE], integrations: MES,
    industries: ['manufacturing', 'logistics'],
  },

  // ---------------- FLOW ----------------
  {
    slug: 'flow-line', pillar: 'flow', name: 'Flow Line', phase: 'Available',
    tagline: 'The micro-stops your OEE report never shows.',
    summary: 'Detects jams, pile-ups, fallen products, spacing problems and short stops on production and packaging lines.',
    detects: ['Jams and pile-ups', 'Fallen or tipped products', 'Gaps and spacing', 'Throughput per SKU', 'Micro-stops under 2 minutes', 'Wrong product after changeover'],
    how: ['Object counting and flow estimation', 'Fusion with motor state from PLC', 'Bottleneck analysis by station'],
    deploy: [CCTV, EDGE], integrations: [...MES, ...CMMS],
    industries: ['manufacturing', 'logistics'],
  },
  {
    slug: 'flow-belt', pillar: 'flow', name: 'Flow Belt', phase: 'Early access',
    tagline: 'Bulk conveyor health from one rugged camera.',
    summary: 'Monitors bulk-material conveyors for rips, edge damage, drift, spillage, chute blockage, hot idlers, slip and foreign objects.',
    detects: ['Belt rips and edge damage', 'Belt misalignment / tracking drift', 'Spillage at transfer points', 'Chute blockage', 'Hot idlers (thermal)', 'Foreign objects and oversize', 'Material load and volume'],
    how: ['Line-scan or area camera on belt surface', 'Thermal camera on idler sets', 'Stereo / 3D for load profile', 'Correlation with drive speed and motor current'],
    deploy: ['Glance Belt Kit (IP66, dust-proof)', 'Thermal camera', EDGE], integrations: CMMS,
    industries: ['heavy-industry', 'energy-utilities', 'transport-infrastructure'],
  },
  {
    slug: 'flow-gate', pillar: 'flow', name: 'Flow Gate', phase: 'Early access',
    tagline: 'Every truck, container and dock — timed.',
    summary: 'Reads number plates and container codes at gates, measures truck turnaround and dock occupancy.',
    detects: ['Number plates', 'ISO container codes', 'Dock door state and occupancy', 'Truck turnaround time'],
    how: ['ANPR / OCR models', 'Event matching in and out', 'Yard dashboards'],
    deploy: [CCTV, EDGE], integrations: ['WMS / TMS', 'Gate barrier control', 'Webhooks & REST API'],
    industries: ['logistics', 'transport-infrastructure', 'heavy-industry'],
  },

  // ---------------- SENSE ----------------
  {
    slug: 'sense-scene', pillar: 'sense', name: 'Sense Scene', phase: 'Available',
    tagline: 'Leaks, spills and clutter — flagged against your own baseline.',
    summary: 'Per-camera baselines of normal operation flag spills, vapour, steam, blocked exits, material in walkways and housekeeping decline.',
    detects: ['Liquid on floor', 'Steam and vapour', 'Blocked exits and walkways', 'Material in pedestrian aisles', 'Daily housekeeping / 5S score'],
    how: ['Normal baseline per camera, by shift and time of day', 'Targeted detectors for common hazards', 'Drift monitoring and baseline refresh'],
    deploy: [CCTV, EDGE], integrations: [...CMMS, ...EHS.slice(0, 2)],
    industries: ['manufacturing', 'heavy-industry', 'logistics', 'energy-utilities'],
  },
  {
    slug: 'sense-machine', pillar: 'sense', name: 'Sense Machine', phase: 'Early access',
    tagline: 'Video that knows what the machine is supposed to be doing.',
    summary: 'Fuses video with PLC and SCADA signals to catch states that neither sees alone.',
    detects: ['Motor on, no movement (jam)', 'Valve closed, vapour visible (leak)', 'Idle equipment', 'Abnormal motion patterns'],
    how: ['OPC-UA / Modbus ingestion', 'Joint rules and learned models', 'Root-cause timelines'],
    deploy: [CCTV, EDGE, 'OT gateway'], integrations: CMMS,
    industries: ['manufacturing', 'heavy-industry', 'energy-utilities'],
  },
  {
    slug: 'sense-thermal', pillar: 'sense', name: 'Sense Thermal', phase: 'Early access',
    tagline: 'Hot spots found before they become failures.',
    summary: 'Thermal monitoring of electrical panels, motors, bearings, transformers and process equipment.',
    detects: ['Panel and connection hot spots', 'Bearing and motor overheating', 'Transformer anomalies', 'Refractory and kiln shell hot spots'],
    how: ['Radiometric thermal cameras', 'Per-asset regions and limits', 'Trend and rate-of-rise alarms'],
    deploy: ['Fixed radiometric thermal cameras', EDGE], integrations: CMMS,
    industries: ['energy-utilities', 'heavy-industry', 'manufacturing'],
  },
  {
    slug: 'sense-gauge', pillar: 'sense', name: 'Sense Gauge', phase: 'Available',
    tagline: 'Digitise analog gauges without touching the process.',
    summary: 'Reads analog dial gauges, level indicators and digital meters from existing cameras, with trends and limit alarms.',
    detects: ['Dial gauge readings', 'Sight-glass levels', 'Digital meter displays', 'Valve positions'],
    how: ['Gauge localisation and needle angle estimation', 'Per-gauge calibration of scale', 'Readings to historian'],
    deploy: [CCTV, 'Optional fixed cameras near gauge clusters', EDGE], integrations: CMMS,
    industries: ['energy-utilities', 'heavy-industry', 'manufacturing'],
  },
  {
    slug: 'sense-gas', pillar: 'sense', name: 'Sense Gas', phase: 'Roadmap',
    tagline: 'Gas imaging and detectors in the same pane of glass.',
    summary: 'Integrates partner optical gas imaging cameras and fixed gas detectors into Glance Hub for unified alerting and evidence.',
    detects: ['Gas plume alerts from OGI partners', 'Fixed detector alarms', 'Correlated visual evidence'],
    how: ['Partner integrations', 'Unified event model', 'Evidence clips'],
    deploy: ['Partner OGI cameras', 'Fixed gas detectors', EDGE], integrations: CMMS,
    industries: ['heavy-industry', 'energy-utilities'],
  },

  // ---------------- INFRA ----------------
  {
    slug: 'infra-structure', pillar: 'infra', name: 'Infra Structure', phase: 'Early access',
    tagline: 'Every crack measured and compared with the last survey.',
    summary: 'Detects and measures cracks, spalling, corrosion, leaks and seepage on bridges, tunnels, dams and buildings, with change detection over time.',
    detects: ['Cracks with width estimation', 'Spalling and exposed rebar', 'Corrosion', 'Efflorescence, leaks and seepage', 'Change since last survey'],
    how: ['Drone, fixed or handheld capture', 'Segmentation and scale-referenced measurement', 'Geo-referenced defect register', 'Engineer review and sign-off'],
    deploy: ['Drone surveys (managed service available)', 'Fixed cameras for critical elements'], integrations: ['GIS', 'BIM', 'Asset management systems'],
    industries: ['transport-infrastructure', 'energy-utilities', 'construction'],
  },
  {
    slug: 'infra-road', pillar: 'infra', name: 'Infra Road', phase: 'Roadmap',
    tagline: 'Network-wide pavement condition from a moving vehicle.',
    summary: 'Maps potholes, cracking, rutting, faded markings and road furniture from vehicle-mounted cameras.',
    detects: ['Potholes', 'Longitudinal, transverse and alligator cracking', 'Rutting', 'Faded markings', 'Sign and furniture inventory'],
    how: ['Vehicle-mounted cameras with GNSS', 'Per-segment condition index', 'Map layers for maintenance planning'],
    deploy: ['Vehicle camera kit', 'Cloud processing'], integrations: ['GIS', 'Road asset management systems'],
    industries: ['transport-infrastructure'],
  },
  {
    slug: 'infra-rail', pillar: 'infra', name: 'Infra Rail', phase: 'Roadmap',
    tagline: 'Track, catenary and platforms — inspected continuously.',
    summary: 'Detects missing fasteners, rail surface defects, overhead catenary faults and track intrusion.',
    detects: ['Missing or broken fasteners', 'Rail surface defects', 'Catenary and dropper faults', 'Track intrusion', 'Platform crowding'],
    how: ['Train- or trolley-mounted cameras', 'Fixed cameras at critical points', 'Chainage-referenced defect register'],
    deploy: ['Rolling-stock camera kit', CCTV, EDGE], integrations: ['Rail asset management', 'GIS'],
    industries: ['transport-infrastructure'],
  },
  {
    slug: 'infra-power', pillar: 'infra', name: 'Infra Power', phase: 'Early access',
    tagline: 'Lines, substations and solar fields — without the climb.',
    summary: 'Inspects transmission lines, towers, substations and solar farms with drones, thermal and fixed cameras.',
    detects: ['Damaged insulators and hardware', 'Vegetation encroachment', 'Substation hot spots and oil leaks', 'Solar panel hot spots and soiling'],
    how: ['Drone RGB + thermal capture', 'Asset-level defect register', 'Engineer review'],
    deploy: ['Drone surveys (managed service available)', 'Fixed substation cameras', EDGE], integrations: ['Utility asset management', 'GIS', ...CMMS.slice(0, 1)],
    industries: ['energy-utilities'],
  },
  {
    slug: 'infra-progress', pillar: 'infra', name: 'Infra Progress', phase: 'Roadmap',
    tagline: 'Construction progress against the schedule and the model.',
    summary: 'Tracks construction progress against schedule and BIM, equipment utilisation and stockpile volumes.',
    detects: ['Progress vs. BIM elements', 'Equipment utilisation', 'Stockpile volumes', 'Material deliveries'],
    how: ['Fixed, 360° and drone capture', 'Comparison with BIM / 4D schedule', 'Weekly progress reports'],
    deploy: ['Glance Pod', 'Drone surveys', '360° cameras'], integrations: ['BIM platforms', 'Project controls / scheduling tools'],
    industries: ['construction', 'transport-infrastructure'],
  },
]);

export const productsByPillar = (p: PillarSlug) => products.filter((x) => x.pillar === p);
export const productBySlug = Object.fromEntries(products.map((p) => [p.slug, p])) as Record<string, Product>;
