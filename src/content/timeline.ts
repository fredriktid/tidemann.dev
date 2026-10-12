export interface TimelineEntry {
  period: string;
  year: string;
  title: string;
  org: string;
  location?: string;
  summary: string;
  roles?: { title: string; period: string }[];
  current?: boolean;
}

export const timeline: TimelineEntry[] = [
  {
    period: 'Jan 2021 — now',
    year: '2021',
    title: 'Tech Lead',
    org: 'Aschehoug',
    location: 'Oslo',
    summary:
      'Leading development of Aunivers, one of Norway’s largest ed-tech platforms, used by hundreds of thousands of students every month across primary, lower and upper secondary, and adult education.',
    current: true,
  },
  {
    period: 'Nov 2011 — Jan 2021',
    year: '2011',
    title: 'Senior Web Developer',
    org: 'Netmaking',
    location: 'Oslo',
    summary:
      'Nine years of consulting on web platforms for clients like KPMG, XL-BYGG, Norcem, Confex and Avinor-integrated parking at Gardermoen. Order systems, course platforms, certification workflows, CMS and CRM integrations.',
    roles: [
      { title: 'Senior Web Developer', period: '2014 — 2021' },
      { title: 'Web Developer', period: '2011 — 2014' },
    ],
  },
  {
    period: 'May 2007 — Nov 2011',
    year: '2007',
    title: 'Administrator & Technical Support',
    org: 'Domeneshop',
    location: 'Oslo',
    summary:
      'Domains, DNS, mail and hosting for one of Norway’s largest registrars. Part time through university, full time after. Where I learned that the boring parts of the internet are the ones that matter.',
    roles: [
      { title: 'Administrator / technical support, full time', period: '2009 — 2011' },
      { title: 'Technical support, part time', period: '2007 — 2009' },
    ],
  },
  {
    period: '2005 — 2009',
    year: '2005',
    title: 'B.Sc. Informatics',
    org: 'University of Oslo',
    summary:
      'Java, Python, algorithms and data structures, systems engineering, calculus, linear algebra, statistics and logic. Freelanced on web projects on the side.',
  },
  {
    period: '2001',
    year: '2001',
    title: 'First lines of code',
    org: 'Seattle',
    summary:
      'IRC scripts, Geocities pages and the first dynamic PHP sites, built as a teenager on a dial-up connection. Liberal use of <marquee> and <blink>, which I maintain were ahead of their time. Still at it.',
  },
];
