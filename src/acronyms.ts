import { Client, Message } from 'discord.js';
import { logger } from './logger';

const WATERCOOLER_CHANNEL_ID = '964903664265359433';
const TECHNICAL_DISCUSSION_CHANNEL_ID = '1068935198567317614';

type AcronymMap = Map<string, string>;

const conversationalAcronyms: AcronymMap = new Map([
  ['afaik', 'as far as I know'],
  ['afk', 'away from keyboard'],
  ['brb', 'be right back'],
  ['bro', 'brother'],
  ['btw', 'by the way'],
  ['cya', 'see you'],
  ['dm', 'direct message'],
  ['fe', 'frontend'],
  ['fomo', 'fear of missing out'],
  ['fr', 'for real'],
  ['ftw', 'for the win'],
  ['fwiw', "for what it's worth"],
  ['fyi', 'for your information'],
  ['gj', 'good job'],
  ['gm', 'good morning'],
  ['gn', 'good night'],
  ['goat', 'greatest of all time'],
  ['icymi', 'in case you missed it'],
  ['idk', "I don't know"],
  ['iirc', 'if I recall correctly'],
  ['imho', 'in my humble opinion'],
  ['imo', 'in my opinion'],
  ['irl', 'in real life'],
  ['iykyk', 'if you know you know'],
  ['j/k', 'just kidding'],
  ['jk', 'just kidding'],
  ['js', 'javascript'],
  ['lmao', 'laughing my ass off'],
  ['lol', 'laughing out loud'],
  ['n/a', 'not applicable'],
  ['n/m', 'nevermind'],
  ['ngl', 'not gonna lie'],
  ['nj', 'nice job'],
  ['noob', 'newbie'],
  ['np', 'no problem'],
  ['nsfw', 'not safe for work'],
  ['nvm', 'nevermind'],
  ['omg', 'oh my god'],
  ['ong', 'on god'],
  ['otoh', 'on the other hand'],
  ['qa', 'quality assurance'],
  ['rip', 'rest in peace'],
  ['rn', 'right now'],
  ['rofl', 'rolling on the floor laughing'],
  ['roflmao', 'rolling on the floor laughing my ass off'],
  ['sis', 'sister'],
  ['smh', 'shaking my head'],
  ['tbh', 'to be honest'],
  ['tl;dr', "too long; didn't read"],
  ['tldr', "too long; didn't read"],
  ['tn', 'tonight'],
  ['ts', 'typescript'],
  ['ty', 'thank you'],
  ['u', 'you'],
  ['ui', 'user interface'],
  ['ux', 'user experience'],
  ['wtf', 'what the fuck'],
  ['wym', 'what you mean'],
  ['wyd', 'what you doing'],
  ['yolo', 'you only live once'],
  ['yw', "you're welcome"],
]);

const technicalAcronyms: AcronymMap = new Map([
  [
    '2fa',
    '[two-factor authentication](https://en.wikipedia.org/wiki/Multi-factor_authentication) - *security process requiring two different authentication factors*',
  ],
  [
    'acid',
    '[atomicity, consistency, isolation, durability](https://en.wikipedia.org/wiki/ACID) - *properties ensuring reliable database transactions*',
  ],
  [
    'aes',
    '[advanced encryption standard](https://en.wikipedia.org/wiki/Advanced_Encryption_Standard) - *symmetric encryption algorithm*',
  ],
  [
    'ai',
    '[artificial intelligence](https://en.wikipedia.org/wiki/Artificial_intelligence) - *computer systems that can perform tasks that typically require human intelligence*',
  ],
  [
    'ajax',
    '[asynchronous javascript and xml](https://en.wikipedia.org/wiki/Ajax_(programming)) - *technique for creating interactive web applications*',
  ],
  [
    'api',
    '[application programming interface](https://en.wikipedia.org/wiki/API) - *set of protocols and tools for building software applications*',
  ],
  [
    'ar',
    '[augmented reality](https://en.wikipedia.org/wiki/Augmented_reality) - *technology overlaying digital information on real world*',
  ],
  [
    'ascii',
    '[american standard code for information interchange](https://en.wikipedia.org/wiki/ASCII) - *character encoding standard*',
  ],
  [
    'aws',
    '[amazon web services](https://en.wikipedia.org/wiki/Amazon_Web_Services) - *cloud computing platform by Amazon*',
  ],
  [
    'base64',
    '[base 64 encoding](https://en.wikipedia.org/wiki/Base64) - *encoding scheme for binary data*',
  ],
  [
    'cdn',
    '[content delivery network](https://en.wikipedia.org/wiki/Content_delivery_network) - *distributed network of servers for faster content delivery*',
  ],
  [
    'cli',
    '[command line interface](https://en.wikipedia.org/wiki/Command-line_interface) - *text-based user interface for interacting with computer programs*',
  ],
  [
    'cms',
    '[content management system](https://en.wikipedia.org/wiki/Content_management_system) - *software for creating and managing digital content*',
  ],
  [
    'cors',
    '[cross-origin resource sharing](https://en.wikipedia.org/wiki/Cross-origin_resource_sharing) - *mechanism allowing web pages to access resources from other domains*',
  ],
  [
    'cpu',
    '[central processing unit](https://en.wikipedia.org/wiki/Central_processing_unit) - *main processor that executes computer instructions*',
  ],
  [
    'crud',
    '[create, read, update, delete](https://en.wikipedia.org/wiki/Create,_read,_update_and_delete) - *four basic operations of persistent storage*',
  ],
  [
    'csrf',
    '[cross-site request forgery](https://en.wikipedia.org/wiki/Cross-site_request_forgery) - *type of malicious exploit of a website*',
  ],
  [
    'css',
    '[cascading style sheets](https://en.wikipedia.org/wiki/CSS) - *style sheet language for describing web page presentation*',
  ],
  [
    'db',
    '[database](https://en.wikipedia.org/wiki/Database) - *organized collection of structured information*',
  ],
  [
    'ddos',
    '[distributed denial of service](https://en.wikipedia.org/wiki/Denial-of-service_attack#Distributed_attack) - *attack using multiple compromised systems*',
  ],
  [
    'dns',
    '[domain name system](https://en.wikipedia.org/wiki/Domain_Name_System) - *hierarchical naming system for internet resources*',
  ],
  [
    'dry',
    "[don't repeat yourself](https://en.wikipedia.org/wiki/Don%27t_repeat_yourself) - *principle of software development*",
  ],
  [
    'dsa',
    '[data structures and algorithms](https://en.wikipedia.org/wiki/Data_structure) - *fundamental concepts for organizing and processing data efficiently*',
  ],
  [
    'dto',
    '[data transfer object](https://en.wikipedia.org/wiki/Data_transfer_object) - *object that carries data between processes*',
  ],
  [
    'etl',
    '[extract, transform, load](https://en.wikipedia.org/wiki/Extract,_transform,_load) - *process for data integration*',
  ],
  [
    'ftp',
    '[file transfer protocol](https://en.wikipedia.org/wiki/File_Transfer_Protocol) - *standard protocol for transferring files*',
  ],
  [
    'gpu',
    '[graphics processing unit](https://en.wikipedia.org/wiki/Graphics_processing_unit) - *specialized processor for rendering graphics and parallel computations*',
  ],
  [
    'grpc',
    '[remote procedure call](https://en.wikipedia.org/wiki/GRPC) - *high-performance RPC framework*',
  ],
  [
    'gui',
    '[graphical user interface](https://en.wikipedia.org/wiki/Graphical_user_interface) - *visual interface using icons, windows, and menus*',
  ],
  [
    'html',
    '[hypertext markup language](https://en.wikipedia.org/wiki/HTML) - *standard markup language for creating web pages*',
  ],
  [
    'http',
    '[hypertext transfer protocol](https://en.wikipedia.org/wiki/HTTP) - *protocol for transferring data over the web*',
  ],
  [
    'https',
    '[hypertext transfer protocol secure](https://en.wikipedia.org/wiki/HTTPS) - *secure version of HTTP using encryption*',
  ],
  [
    'iaas',
    '[infrastructure as a service](https://en.wikipedia.org/wiki/Infrastructure_as_a_service) - *cloud computing service providing virtualized resources*',
  ],
  [
    'ide',
    '[integrated development environment](https://en.wikipedia.org/wiki/Integrated_development_environment) - *software application with comprehensive tools for development*',
  ],
  [
    'iot',
    '[internet of things](https://en.wikipedia.org/wiki/Internet_of_things) - *network of connected physical devices*',
  ],
  [
    'ip',
    '[internet protocol](https://en.wikipedia.org/wiki/Internet_Protocol) - *protocol for routing packets across networks*',
  ],
  [
    'json',
    '[javascript object notation](https://en.wikipedia.org/wiki/JSON) - *lightweight data-interchange format*',
  ],
  [
    'jwt',
    '[json web token](https://en.wikipedia.org/wiki/JSON_Web_Token) - *compact method for securely transmitting information*',
  ],
  [
    'kiss',
    '[keep it simple, stupid](https://en.wikipedia.org/wiki/KISS_principle) - *design principle favoring simplicity*',
  ],
  [
    'md5',
    '[message digest 5](https://en.wikipedia.org/wiki/MD5) - *cryptographic hash function*',
  ],
  [
    'mime',
    '[multipurpose internet mail extensions](https://en.wikipedia.org/wiki/MIME) - *standard for email message format*',
  ],
  [
    'ml',
    '[machine learning](https://en.wikipedia.org/wiki/Machine_learning) - *type of AI that learns patterns from data*',
  ],
  [
    'mvc',
    '[model-view-controller](https://en.wikipedia.org/wiki/Model%E2%80%93view%E2%80%93controller) - *architectural pattern separating application logic*',
  ],
  [
    'nlp',
    '[natural language processing](https://en.wikipedia.org/wiki/Natural_language_processing) - *AI field focused on language understanding*',
  ],
  [
    'nosql',
    '[not only sql](https://en.wikipedia.org/wiki/NoSQL) - *database design approach for large-scale data storage*',
  ],
  [
    'npm',
    '[node package manager](https://en.wikipedia.org/wiki/Npm) - *package manager for JavaScript*',
  ],
  [
    'oauth',
    '[open authorization](https://en.wikipedia.org/wiki/OAuth) - *open standard for access delegation*',
  ],
  [
    'orm',
    '[object-relational mapping](https://en.wikipedia.org/wiki/Object%E2%80%93relational_mapping) - *technique for converting between incompatible type systems*',
  ],
  [
    'os',
    '[operating system](https://en.wikipedia.org/wiki/Operating_system) - *software that manages computer hardware and software resources*',
  ],
  [
    'p2p',
    '[peer-to-peer](https://en.wikipedia.org/wiki/Peer-to-peer) - *distributed application architecture*',
  ],
  [
    'paas',
    '[platform as a service](https://en.wikipedia.org/wiki/Platform_as_a_service) - *cloud computing service providing development platform*',
  ],
  [
    'pr',
    '[pull request](https://en.wikipedia.org/wiki/Distributed_version_control#Pull_requests) - *method of submitting contributions to a code repository*',
  ],
  [
    'pwa',
    '[progressive web application](https://en.wikipedia.org/wiki/Progressive_web_app) - *web app with native app-like features*',
  ],
  [
    'raid',
    '[redundant array of independent disks](https://en.wikipedia.org/wiki/RAID) - *data storage virtualization technology*',
  ],
  [
    'ram',
    '[random access memory](https://en.wikipedia.org/wiki/Random-access_memory) - *volatile computer memory for temporary data storage*',
  ],
  [
    'rest',
    '[representational state transfer](https://en.wikipedia.org/wiki/REST) - *architectural style for distributed systems*',
  ],
  [
    'rsa',
    '[rivest-shamir-adleman](https://en.wikipedia.org/wiki/RSA_(cryptosystem)) - *public-key cryptosystem*',
  ],
  [
    'saas',
    '[software as a service](https://en.wikipedia.org/wiki/Software_as_a_service) - *software licensing and delivery model*',
  ],
  [
    'sdk',
    '[software development kit](https://en.wikipedia.org/wiki/Software_development_kit) - *collection of tools for developing applications*',
  ],
  [
    'seo',
    '[search engine optimization](https://en.wikipedia.org/wiki/Search_engine_optimization) - *practice of improving website visibility in search results*',
  ],
  [
    'sha256',
    '[secure hash algorithm 256](https://en.wikipedia.org/wiki/SHA-2) - *cryptographic hash function*',
  ],
  [
    'smtp',
    '[simple mail transfer protocol](https://en.wikipedia.org/wiki/Simple_Mail_Transfer_Protocol) - *protocol for sending email messages*',
  ],
  [
    'spa',
    '[single page application](https://en.wikipedia.org/wiki/Single-page_application) - *web app that loads a single page and updates dynamically*',
  ],
  [
    'sql',
    '[structured query language](https://en.wikipedia.org/wiki/SQL) - *programming language for managing relational databases*',
  ],
  [
    'ssh',
    '[secure shell](https://en.wikipedia.org/wiki/Secure_Shell) - *cryptographic protocol for secure remote access*',
  ],
  [
    'sse',
    '[server-sent events](https://en.wikipedia.org/wiki/Server-sent_events) - *standard for server-to-client real-time communication*',
  ],
  [
    'ssl',
    '[secure sockets layer](https://en.wikipedia.org/wiki/Transport_Layer_Security) - *cryptographic protocol for secure communication*',
  ],
  [
    'sso',
    '[single sign-on](https://en.wikipedia.org/wiki/Single_sign-on) - *authentication scheme allowing access to multiple applications*',
  ],
  [
    'ssd',
    '[solid state drive](https://en.wikipedia.org/wiki/Solid-state_drive) - *data storage device using flash memory*',
  ],
  [
    'tcp',
    '[transmission control protocol](https://en.wikipedia.org/wiki/Transmission_Control_Protocol) - *reliable, connection-oriented transport protocol*',
  ],
  [
    'tdd',
    '[test-driven development](https://en.wikipedia.org/wiki/Test-driven_development) - *software development approach writing tests before code*',
  ],
  [
    'tls',
    '[transport layer security](https://en.wikipedia.org/wiki/Transport_Layer_Security) - *cryptographic protocol for secure communication*',
  ],
  [
    'udp',
    '[user datagram protocol](https://en.wikipedia.org/wiki/User_Datagram_Protocol) - *connectionless transport protocol*',
  ],
  [
    'url',
    '[uniform resource locator](https://en.wikipedia.org/wiki/URL) - *web address specifying location of a resource*',
  ],
  [
    'utf8',
    '[8-bit unicode transformation format](https://en.wikipedia.org/wiki/UTF-8) - *variable-length character encoding*',
  ],
  [
    'uuid',
    '[universally unique identifier](https://en.wikipedia.org/wiki/Universally_unique_identifier) - *128-bit identifier used in software*',
  ],
  [
    'vm',
    '[virtual machine](https://en.wikipedia.org/wiki/Virtual_machine) - *software emulation of a computer system*',
  ],
  [
    'vpn',
    '[virtual private network](https://en.wikipedia.org/wiki/Virtual_private_network) - *encrypted connection over public networks*',
  ],
  [
    'vr',
    '[virtual reality](https://en.wikipedia.org/wiki/Virtual_reality) - *computer-generated simulation of 3D environment*',
  ],
  [
    'webrtc',
    '[web real-time communication](https://en.wikipedia.org/wiki/WebRTC) - *technology enabling real-time communication in browsers*',
  ],
  [
    'wsl',
    '[windows subsystem for linux](https://en.wikipedia.org/wiki/Windows_Subsystem_for_Linux) - *compatibility layer for running Linux on Windows*',
  ],
  [
    'xml',
    '[extensible markup language](https://en.wikipedia.org/wiki/XML) - *markup language for storing and transporting data*',
  ],
  [
    'xss',
    '[cross-site scripting](https://en.wikipedia.org/wiki/Cross-site_scripting) - *type of security vulnerability in web applications*',
  ],
  [
    'yaml',
    '[yet another markup language](https://en.wikipedia.org/wiki/YAML) - *human-readable data serialization standard*',
  ],
]);

function detectAcronyms(content: string, acronyms: AcronymMap): string[] {
  const words = content.toLowerCase().split(/\b/);
  const detectedAcronyms = words.filter((word) => acronyms.has(word));

  const wordsWithSpaces = content.toLowerCase().split(/\s+/);
  const detectedAcronymsWithSpaces = wordsWithSpaces.filter((word) =>
    acronyms.has(word)
  );

  return Array.from(
    new Set([...detectedAcronyms, ...detectedAcronymsWithSpaces])
  );
}

export function registerAcronymListeners(client: Client): void {
  logger.info('Acronym listeners registered');

  client.on('messageCreate', async (message: Message) => {
    try {
      if (message.author.bot) return;

      let acronyms: AcronymMap;
      let detectedAcronyms: string[] = [];
      switch (message.channel.id) {
        case WATERCOOLER_CHANNEL_ID:
          acronyms = conversationalAcronyms;
          break;
        case TECHNICAL_DISCUSSION_CHANNEL_ID:
          acronyms = technicalAcronyms;
          break;
        default:
          return;
      }

      detectedAcronyms = detectAcronyms(message.content, acronyms);

      if (detectedAcronyms.length > 0) {
        const definitions = detectedAcronyms
          .map((acronym) => `${acronym} = ${acronyms.get(acronym)}`)
          .join('\n');

        await message.reply(definitions);

        logger.info({
          event: 'acronyms_detected',
          userId: message.author.id,
          acronyms: detectedAcronyms,
          channelId: message.channel.id,
        });
      }
    } catch (error) {
      logger.error({
        event: 'acronym_detection_error',
        error: error instanceof Error ? error.message : 'Unknown error',
        messageId: message.id,
      });
    }
  });
}
