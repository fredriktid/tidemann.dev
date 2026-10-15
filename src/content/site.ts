export const site = {
  name: 'Fredrik Tidemann',
  domain: 'tidemann.dev',
  role: 'Tech lead & web developer',
  tagline: 'Building for the web since 2001.',
  location: 'Oslo, Norway',
  email: 'fredrik@tidemann.dev',
  linkedin: 'https://www.linkedin.com/in/fredrik-tidemann-26637553',
  github: 'https://github.com/fredriktid',
  description:
    'Tech lead and web developer in Oslo. More than twenty years of building fast, reliable web products. Now leading ed-tech development at Aschehoug.',
  headline: 'Tech lead who still writes code.',
  lede: 'I have built fast, reliable things for the web for more than twenty years. Today I lead ed-tech development at Aschehoug.',
  intro: [
    'I lead teams and write code for the web. I care about the whole stack, from the database and the cache in front of it to the last millisecond before the page shows up.',
    'After more than twenty years, I still think it is a little crazy, and wonderful, that the web runs everywhere. Lately I have been exploring what WebAssembly can do in the browser. That is why the map at the top of this page is computed in WebAssembly, not JavaScript.',
  ],
  contact:
    'Do you need someone to lead a web team, sort out an architecture, or write a lot of solid code? Or do you just want to talk about WebAssembly, caching or DNS? Email is the best way to reach me.',
  offDuty: 'Off duty I ride gravel, snowboard, and spend as much time outside as I can.',
  skills: [
    {
      area: 'Code',
      lead: true,
      text: 'My main strength, and where most of my time goes. TypeScript everywhere, with Vue, Nuxt, React and Astro on top and PostgreSQL and MongoDB underneath. AssemblyScript and WebAssembly when speed matters. Some Java, Kotlin, PHP and Python where a project needs it.',
    },
    {
      area: 'Design to front end',
      text: 'From a rough sketch to a working interface. I care about layout, type and how fast the page feels.',
    },
    {
      area: 'Search',
      text: 'Search experiences with Solr and Elasticsearch: indexing, relevance, filters and fast results.',
    },
    {
      area: 'DevOps and cloud',
      text: 'Builds, deploys and running services on AWS, Cloudflare and other platforms. Docker for local setups that match production, and caching in Varnish to keep things fast under load.',
    },
    {
      area: 'DNS and hosting',
      text: 'DNS with BIND, mail and hosting. I learned this part of the internet properly at a domain registrar, and I still use it.',
    },
  ],
} as const;
