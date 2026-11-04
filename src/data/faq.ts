import { products } from './products';
import { nbDeep } from './helpers';

const available = products.filter((p) => p.phase === 'Available').length;

export const faq: { group: string; items: { q: string; a: string }[] }[] = nbDeep<{ group: string; items: { q: string; a: string }[] }[]>([
  {
    group: 'General',
    items: [
      { q: 'What does Infraglance do?', a: `We turn cameras, drones and sensors into real-time intelligence on safety, quality, operations and the condition of infrastructure assets. There are ${products.length} products across five pillars — Guard, Inspect, Flow, Sense and Infra — on one edge-first platform: ${available} available today and the rest in early access or on the roadmap. Custom engineering covers problems no product addresses yet.` },
      { q: 'Do you sell products or custom projects?', a: 'Both, on the same platform. A typical engagement starts with a product and a short configuration. When a use case needs a new model, special imaging or a deep integration, Infraglance Engineering builds it — and it is then maintained like any other product.' },
      { q: 'Which industries do you work with?', a: 'Manufacturing, heavy and process industry (steel, cement, mining, oil & gas, chemicals), energy and utilities, transport infrastructure, construction and logistics.' },
      { q: 'Do you have case studies?', a: 'Infraglance is a new company running a design-partner programme. We publish case studies only with real, measured results and the customer’s permission — until then we are happy to show the platform live in our Experience Lab or on your own footage.' },
    ],
  },
  {
    group: 'Cameras & hardware',
    items: [
      { q: 'Does it work with our existing cameras?', a: 'Yes, for most safety, flow and plant-condition products. Any IP camera that streams RTSP or ONVIF works. Inspection products usually need controlled lighting and a fixed camera geometry, which we supply as inspection station kits.' },
      { q: 'What hardware do we need on site?', a: 'A Glance Edge box sized to the number of camera streams and models (from a fanless unit for one zone to a rack server for a whole site). Optional: inspection stations, thermal cameras, the rugged Belt Kit for conveyors, Glance Pod for sites without CCTV, and Glance Nudge speakers or strobes.' },
      { q: 'Does it work at night or in dust and steam?', a: 'Often, but it depends on the camera and lighting. The feasibility study checks your actual footage across shifts. Where visible light is not enough we recommend IR illumination or thermal cameras, and say so in writing before you commit.' },
      { q: 'Can it run in hazardous areas?', a: 'Edge boxes are installed outside the hazardous zone. Cameras and enclosures for ATEX / IECEx zones are supplied through certified partners for each deployment.' },
    ],
  },
  {
    group: 'Data & privacy',
    items: [
      { q: 'What data leaves our site?', a: 'By default only events, short evidence clips and metadata. Video is processed on the edge box on your site, and retention is configurable. Fully on-premise and air-gapped deployments are available.' },
      { q: 'Do you use facial recognition?', a: 'No, not by default. Faces are blurred on the edge device. Identification is enabled only where it is contractually required, lawful and disclosed to workers.' },
      { q: 'Is this used to monitor individual workers?', a: 'No. Our ethics charter rules out individual performance scoring. Safety and ergonomics analytics are reported by zone, station and shift, and every alert can be reviewed or overridden by a person.' },
      { q: 'How do you handle GDPR, India’s DPDP Act and the EU AI Act?', a: 'The platform is designed for data minimisation, logging and human oversight, and we provide worker-notice templates and documentation to support your own assessment. Obligations depend on how a system is used, so your legal team should review each deployment.' },
    ],
  },
  {
    group: 'Accuracy & performance',
    items: [
      { q: 'How accurate is it?', a: 'It depends on your cameras, lighting and use case — which is why every engagement starts with a feasibility study on your own footage or samples. Accuracy and false-alarm limits are agreed in writing and reported monthly on an accuracy report card.' },
      { q: 'How do you avoid alert floods?', a: 'One violation becomes one event with a duration and severity, de-duplicated across frames and cameras. Events escalate only if they persist, and every site has an alert budget agreed with the team that has to act on it.' },
      { q: 'Do we need lots of defect images to start inspection?', a: 'No. Inspect Defect learns from good parts only (typically 50–200 images per SKU) and adds supervised models for known defect types as examples are collected.' },
      { q: 'What happens when conditions change?', a: 'Every camera is monitored for drift. When lighting, viewpoint or products change, the system flags it and the baseline or model is refreshed — with staged rollout and automatic rollback.' },
    ],
  },
  {
    group: 'Deployment & integration',
    items: [
      { q: 'How long does a deployment take?', a: 'A feasibility study takes one to two weeks, a proof of value four to eight weeks, and a site rollout typically four to twelve weeks depending on cameras, integrations and approvals.' },
      { q: 'Which systems do you integrate with?', a: 'PLC and SCADA (OPC-UA, Modbus, MQTT), MES and ERP, maintenance systems such as SAP PM and IBM Maximo, EHS platforms, video management systems, GIS and BIM, plus REST, webhooks and Teams / WhatsApp / SMS notifications.' },
      { q: 'Can our integrator deliver it?', a: 'Yes. Integrators can deliver Infraglance with Glance Studio and the API, or white-label it through our partner programme.' },
    ],
  },
  {
    group: 'Commercial',
    items: [
      { q: 'How is it priced?', a: 'Products are annual subscriptions per camera, inspection station or asset. Hardware is bought or leased. Feasibility studies, proofs of value and custom engineering are fixed-fee or milestone projects. See the pricing and engagement page for what drives cost.' },
      { q: 'Who owns the data and models?', a: 'You own your footage, images and data. Infraglance owns the platform and models so they stay supported. General model improvements return to the product only with your consent.' },
    ],
  },
]);
