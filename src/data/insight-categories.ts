export const insightCategories = ['Safety', 'Quality', 'Operations', 'Infrastructure', 'Edge & Platform', 'Strategy', 'Regulation'] as const;
export type InsightCategory = (typeof insightCategories)[number];

/** One-sentence meta description per category page (at most ~155 characters). */
export const insightCategoryMeta: Record<InsightCategory, string> = {
  Safety: 'Engineering notes on industrial safety with vision AI: PPE that is actually worn, vehicle–pedestrian near-misses and warnings at the point of work.',
  Quality: 'Engineering notes on inline quality inspection: anomaly models trained on good parts, colour and shade measurement, lighting and calibration.',
  Operations: 'Engineering notes on plant operations: conveyor belt monitoring, analog gauge reading and the PLC signals that make video analytics useful.',
  Infrastructure: 'Engineering notes on infrastructure inspection: drone surveys, crack measurement you can defend, change tracking and engineer-reviewed reports.',
  'Edge & Platform': 'Engineering notes on where industrial video analytics should run: edge, cloud or hybrid, weighed on bandwidth, latency, privacy and offline operation.',
  Strategy: 'Engineering notes on the business case for vision AI: baselines, leading indicators, pilot design and total cost, without borrowed ROI claims.',
  Regulation: 'Engineering notes on workplace vision AI and the law: GDPR, India’s DPDP Act and the EU AI Act, and designing for safety, not surveillance.',
};
