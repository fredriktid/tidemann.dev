export interface Project {
  title: string;
  client: string;
  kind: string;
  summary: string;
  logo?: { src: string; width: number; height: number };
  href?: string;
  featured?: boolean;
  quote?: string;
}

export const projects: Project[] = [
  {
    title: 'Aunivers',
    client: 'Aschehoug',
    kind: 'Ed-tech platform · 2021 — now',
    summary:
      'I lead the team that builds and runs Aunivers. Hundreds of thousands of students use it every month, from first grade all the way to adult education, so it had better work on a Monday morning.',
    quote: 'Med læreren. For eleven.',
    logo: { src: '/logos/aunivers.svg', width: 109, height: 25 },
    href: 'https://aunivers.no',
    featured: true,
  },
  {
    title: 'Web architecture for a full rewrite',
    client: 'Juridika',
    kind: 'Advisory role',
    summary:
      'Advisory role for the overall web architecture and the integration with business systems in the complete rewrite of the whole Juridika application.',
  },
  {
    title: 'Book registration, metadata and search',
    client: 'Bokbasen',
    kind: 'Industry infrastructure',
    summary:
      'Worked on the systems the Norwegian book trade runs on: registering new books, sending metadata out to the industry, and the search that publishers, bookshops and libraries use every day.',
    logo: { src: '/logos/bokbasen.svg', width: 140, height: 20 },
  },
  {
    title: 'Course and certification system',
    client: 'KPMG',
    kind: 'Internal platform',
    summary:
      'Built the course system KPMG’s lawyers and auditors use to keep their certification. They need a set number of course hours each period, and the system keeps track of sign-ups, hours and reporting in one place.',
    logo: { src: '/logos/kpmg.svg', width: 77, height: 30 },
  },
  {
    title: 'Ordering for professional customers',
    client: 'XL-BYGG',
    kind: 'B2B commerce',
    summary:
      'Made a custom ordering solution for the trade customers of XL-BYGG, so builders across some 110 stores can order what they need without the back-and-forth.',
    logo: { src: '/logos/xl-bygg.svg', width: 360, height: 229 },
  },
  {
    title: 'National cement ordering',
    client: 'Norcem',
    kind: 'Order system',
    summary:
      'Built the order system for Norcem, who deliver roughly 90 % of the cement used in Norway. Seen a cement truck lately? Decent chance the order went through here.',
  },
  {
    title: 'Airport valet parking',
    client: 'Dalen Parkering',
    kind: 'Ordering and operations',
    summary:
      'Built the valet parking system at Oslo Airport Gardermoen: the ordering for customers and the tools the staff use every day. Hooked up to Avinor’s flight data, so the timing follows your flight.',
    logo: { src: '/logos/dalen-parkering.png', width: 331, height: 60 },
  },
  {
    title: 'Training platform',
    client: 'Confex',
    kind: 'Course sign-ups, management and CMS',
    summary:
      'Built the whole web solution for Norway’s largest training provider: course catalogue, sign-ups and admin, wired up to their CRM and marketing tools.',
    logo: { src: '/logos/confex.svg', width: 130, height: 35 },
  },
  {
    title: 'ISO certification workflow',
    client: 'Kiwa',
    kind: 'Certification application · formerly Teknologisk Institutt',
    summary:
      'Built a certification application that follows the full process for several ISO standards, from the first application through audit and follow-up.',
    logo: { src: '/logos/kiwa.svg', width: 120, height: 40 },
  },
  {
    title: 'Website, PIM and ordering',
    client: 'Skala',
    kind: 'CMS with integrated PIM',
    summary:
      'Made the website, CMS, product information system and ordering for Norway’s largest professional community in process technology for the food industry.',
    logo: { src: '/logos/skala.svg', width: 155, height: 41 },
  },
];
