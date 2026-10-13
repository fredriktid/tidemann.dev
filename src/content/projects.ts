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
      'I lead the team that builds and runs Aunivers. Hundreds of thousands of students use it every month, from first grade to adult education, so it has to work on a Monday morning.',
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
      'Advisor on the overall web architecture, and on how it connects to the business systems, in a full rewrite of the Juridika application.',
  },
  {
    title: 'Book registration, metadata and search',
    client: 'Bokbasen',
    kind: 'Industry infrastructure',
    summary:
      'Worked on the systems the Norwegian book trade depends on: registering new books, sending book data out to the industry, and the search that publishers, bookshops and libraries use every day.',
    logo: { src: '/logos/bokbasen.svg', width: 140, height: 20 },
  },
  {
    title: 'Course and certification system',
    client: 'KPMG',
    kind: 'Internal platform',
    summary:
      'Built the course system that KPMG’s lawyers and auditors use to keep their certification. They need a certain number of course hours in each period, and the system tracks sign-ups, hours and reporting in one place.',
    logo: { src: '/logos/kpmg.svg', width: 77, height: 30 },
  },
  {
    title: 'Ordering for professional customers',
    client: 'XL-BYGG',
    kind: 'B2B commerce',
    summary:
      'Made a custom ordering system for XL-BYGG’s trade customers, so builders at around 110 stores can order what they need without calling back and forth.',
    logo: { src: '/logos/xl-bygg.svg', width: 360, height: 229 },
  },
  {
    title: 'National cement ordering',
    client: 'Norcem',
    kind: 'Order system',
    summary:
      'Built the order system for Norcem, who deliver about 90 % of the cement used in Norway. If you see a cement truck, there is a good chance the order went through this system.',
  },
  {
    title: 'Airport valet parking',
    client: 'Dalen Parkering',
    kind: 'Ordering and operations',
    summary:
      'Built the valet parking system at Oslo Airport Gardermoen: online booking for customers and the tools the staff use every day. It uses flight data from Avinor, so the timing follows your flight.',
    logo: { src: '/logos/dalen-parkering.png', width: 331, height: 60 },
  },
  {
    title: 'Training platform',
    client: 'Confex',
    kind: 'Course sign-ups, management and CMS',
    summary:
      'Built the whole web solution for the largest training provider in Norway: course catalogue, sign-ups and admin, connected to their CRM and marketing tools.',
    logo: { src: '/logos/confex.svg', width: 130, height: 35 },
  },
  {
    title: 'ISO certification workflow',
    client: 'Kiwa',
    kind: 'Certification application · formerly Teknologisk Institutt',
    summary:
      'Built a certification application that follows the full process for several ISO standards, from the first application to audit and follow-up.',
    logo: { src: '/logos/kiwa.svg', width: 120, height: 40 },
  },
  {
    title: 'Website, PIM and ordering',
    client: 'Skala',
    kind: 'CMS with integrated PIM',
    summary:
      'Made the website, CMS, product information system and ordering for the largest professional community for process technology in the Norwegian food industry.',
    logo: { src: '/logos/skala.svg', width: 155, height: 41 },
  },
];
