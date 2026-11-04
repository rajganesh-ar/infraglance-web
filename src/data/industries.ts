import type { PillarSlug } from './pillars';
import { nbDeep } from './helpers';

export type IndustrySlug = 'manufacturing' | 'heavy-industry' | 'energy-utilities' | 'transport-infrastructure' | 'construction' | 'logistics';

export interface Industry {
  slug: IndustrySlug;
  name: string;
  segments: string;
  summary: string;
  challenges: string[];
  useCases: { title: string; text: string; product: string }[];
  pillars: PillarSlug[];
  glyph: string; // short code for tile
  photo: string;
  video?: string;
  /** Photo strip under the challenges: media key + one-line caption. */
  gallery?: { img: string; caption: string }[];
  /** Section heading above the challenges list. */
  challengeHead: string;
  /** Closing call-to-action heading. */
  cta: string;
  /** Closing call-to-action backdrop (the page falls back to an unused one if it already shows it). */
  ctaImg?: string;
}

export const industries: Industry[] = nbDeep<Industry[]>([
  {
    slug: 'manufacturing', photo: 'auto-assembly', name: 'Manufacturing', glyph: 'MFG',
    challengeHead: 'Where quality, uptime and safety slip.',
    cta: 'Let’s look at your lines and stations.',
    ctaImg: 'robot-cell',
    gallery: [{ img: 'plastic-molding', caption: 'Moulding: short shots, flash and sink marks caught at the press.' }, { img: 'castings', caption: 'Cast and machined parts: porosity, burrs and missing features.' }, { img: 'pcb-inspection', caption: 'Electronics: solder, placement and label checks.' }],
    segments: 'Automotive · Metals · Plastics · FMCG · Pharma · Textiles · Electronics',
    summary: 'Safety, quality and line flow from one platform — on the same cameras and edge boxes.',
    challenges: ['Defects escaping to customers and costly claims', 'Shade and colour variation between batches', 'Micro-stops that never appear in OEE reports', 'PPE and machine-guarding compliance across shifts'],
    useCases: [
      { title: 'Defect and colour inspection', text: 'Train on good parts, measure ΔE against the master, reject or route for review.', product: 'inspect-defect' },
      { title: 'Machine danger zones', text: 'Zones around presses and robot cells that arm with machine state.', product: 'guard-zone' },
      { title: 'Line flow and micro-stops', text: 'Jams, gaps and short stops detected and attributed to stations.', product: 'flow-line' },
      { title: 'Correct PPE by task', text: 'Gloves at the press, face shield at the grinder, hairnet in food zones.', product: 'guard-ppe' },
    ],
    pillars: ['guard', 'inspect', 'flow', 'sense'],
  },
  {
    slug: 'heavy-industry', photo: 'steel-plant', name: 'Heavy & process industry', glyph: 'HVY',
    challengeHead: 'Harsh plants, high-consequence failures.',
    cta: 'Let’s look at your plant.',
    ctaImg: 'industrial-night',
    gallery: [{ img: 'cement-plant', caption: 'Cement and minerals: kilns, conveyors and dust.' }, { img: 'chemical-plant-night', caption: 'Process plants: leaks, vapour and gauges around the clock.' }, { img: 'castings', caption: 'Foundry output: porosity and cracks on cast parts.' }],
    segments: 'Steel · Cement · Mining · Oil & gas · Chemicals',
    summary: 'Harsh environments, bulk conveyors and high-consequence hazards — monitored continuously.',
    challenges: ['Conveyor failures that stop the whole plant', 'Leaks, spills and hot spots found too late', 'Permit-to-work conditions not verified in the field', 'Dust, heat and vibration that defeat ordinary cameras'],
    useCases: [
      { title: 'Bulk conveyor health', text: 'Rips, drift, spillage, blockages and hot idlers from one rugged unit.', product: 'flow-belt' },
      { title: 'Leaks and vapour', text: 'Scene baselines that flag steam, vapour and liquid where it should not be.', product: 'sense-scene' },
      { title: 'Permit verification', text: 'Barricades, extinguishers and attendants checked when a permit opens.', product: 'guard-permit' },
      { title: 'Thermal monitoring', text: 'Kiln shells, motors and panels watched for rate-of-rise.', product: 'sense-thermal' },
    ],
    pillars: ['guard', 'flow', 'sense'],
  },
  {
    slug: 'energy-utilities', photo: 'substation', video: 'v-power-aerial', name: 'Energy & utilities', glyph: 'NRG',
    challengeHead: 'Remote assets, few people, high stakes.',
    cta: 'Let’s look at your substations and plants.',
    ctaImg: 'v-refinery-night',
    gallery: [{ img: 'solar-farm', caption: 'Solar: soiling, damaged modules and perimeter intrusion.' }, { img: 'wind-turbines', caption: 'Wind: blade and tower surveys from drone imagery.' }, { img: 'transmission-tower', caption: 'Transmission: tower and line defects found by drone.' }, { img: 'electrical-panel', caption: 'Switchrooms: panels, breakers and indicator lights.' }],
    segments: 'Power generation · Transmission & distribution · Solar & wind · Water',
    summary: 'Substations, lines and plants inspected and monitored without sending people into harm’s way.',
    challenges: ['Remote, unmanned assets', 'Manual gauge rounds in brownfield plants', 'Line and tower inspection risk', 'Thermal faults in substations'],
    useCases: [
      { title: 'Substation monitoring', text: 'Hot spots, oil leaks, intrusion and gauge reading at unmanned substations.', product: 'infra-power' },
      { title: 'Gauge digitisation', text: 'Analog gauges read from cameras straight into the historian.', product: 'sense-gauge' },
      { title: 'Thermal assets', text: 'Transformers, breakers and bearings with trend alarms.', product: 'sense-thermal' },
      { title: 'Solar surveys', text: 'Drone thermal surveys for panel hot spots and soiling.', product: 'infra-power' },
    ],
    pillars: ['sense', 'infra', 'guard'],
  },
  {
    slug: 'transport-infrastructure', photo: 'bridge-piers', name: 'Transport infrastructure', glyph: 'TRN',
    challengeHead: 'Ageing networks, limited inspection capacity.',
    cta: 'Let’s look at your network.',
    ctaImg: 'v-bridge-aerial',
    gallery: [{ img: 'highway-aerial', caption: 'Roads: surface defects and asset registers from vehicle surveys.' }, { img: 'railway-tracks', caption: 'Rail: track, fastening and trackside asset checks.' }, { img: 'tunnel', caption: 'Tunnels: lining cracks, leaks and spalling.' }, { img: 'metro-platform', caption: 'Stations: crowding and platform-edge safety.' }],
    segments: 'Rail & metro · Highways · Bridges · Tunnels · Ports · Airports',
    summary: 'Condition intelligence and safety for the networks people and goods move on.',
    challenges: ['Ageing structures and limited inspection capacity', 'Inconsistent manual inspection records', 'Track intrusion and platform crowding', 'Gate and yard congestion at ports'],
    useCases: [
      { title: 'Bridge and tunnel inspection', text: 'Drone capture, crack measurement and change tracking with engineer sign-off.', product: 'infra-structure' },
      { title: 'Rail inspection', text: 'Fasteners, rail surface and catenary from rolling-stock cameras.', product: 'infra-rail' },
      { title: 'Road condition', text: 'Network-wide pavement distress from vehicle cameras.', product: 'infra-road' },
      { title: 'Port gates', text: 'Container codes, plates and turnaround time at every gate.', product: 'flow-gate' },
    ],
    pillars: ['infra', 'guard', 'flow'],
  },
  {
    slug: 'construction', photo: 'construction-cranes', name: 'Construction & EPC', glyph: 'CON',
    challengeHead: 'Moving sites, work at height, tight schedules.',
    cta: 'Let’s look at your next project.',
    ctaImg: 'highway-aerial',
    gallery: [{ img: 'ppe-helmet-closeup', caption: 'Site PPE: helmets, glasses and hi-vis checked by zone.' }, { img: 'harness-worker', caption: 'Work at height: harness worn, but is the hook tied off?' }, { img: 'ppe-gloves', caption: 'Task PPE: the right gloves for cutting, grinding and handling.' }],
    segments: 'Large projects · Industrial construction · Infrastructure EPC',
    summary: 'Safety and progress on sites that change every week — with or without fixed CCTV.',
    challenges: ['Falls from height', 'No fixed cameras, power or network on site', 'Plant–pedestrian interaction', 'Progress reporting against schedule'],
    useCases: [
      { title: 'Work at height', text: 'Harness tie-off and unprotected edges on scaffolds and structures.', product: 'guard-height' },
      { title: 'Portable monitoring', text: 'Solar + 4G Glance Pod units moved as the site evolves.', product: 'guard-ppe' },
      { title: 'Swing radius', text: 'Crane and excavator exclusion zones.', product: 'guard-zone' },
      { title: 'Progress vs BIM', text: 'Weekly progress against the model and schedule.', product: 'infra-progress' },
    ],
    pillars: ['guard', 'infra'],
  },
  {
    slug: 'logistics', photo: 'parcel-conveyor', name: 'Logistics & warehousing', glyph: 'LOG',
    challengeHead: 'Busy aisles, crowded docks, tight windows.',
    cta: 'Let’s look at your warehouse and yard.',
    ctaImg: 'industrial-night',
    gallery: [{ img: 'port-terminal', caption: 'Ports and yards: vehicle and person separation.' }, { img: 'truck-gate', caption: 'Gates: plate, seal and container checks.' }, { img: 'v-warehouse-forklift', caption: 'Aisles: order pickers and forklifts share the racking with people on foot.' }],
    segments: 'Warehouses · Distribution centres · Cold chain · Yards',
    summary: 'Forklift safety, dock flow and package quality across every shift.',
    challenges: ['Forklift–pedestrian incidents', 'Dock congestion and truck dwell time', 'Ergonomic injuries from manual handling', 'Damaged and mislabelled shipments'],
    useCases: [
      { title: 'Forklift safety', text: 'Proximity, speeding and near-miss hot spots by aisle.', product: 'guard-traffic' },
      { title: 'Yard and docks', text: 'Plates, containers, dock occupancy and turnaround.', product: 'flow-gate' },
      { title: 'Package checks', text: 'Label, barcode and carton damage at induction.', product: 'inspect-pack' },
      { title: 'Ergonomics', text: 'Lifting risk by workstation to target redesigns.', product: 'guard-ergo' },
    ],
    pillars: ['guard', 'flow', 'inspect'],
  },
]);

export const industryBySlug = Object.fromEntries(industries.map((i) => [i.slug, i])) as Record<IndustrySlug, Industry>;
