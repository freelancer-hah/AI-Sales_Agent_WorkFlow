export interface StateData {
  name: string;
  cities: string[];
}

export interface CountryData {
  name: string;
  code: string;
  states: StateData[];
}

export const COUNTRIES_DATA: CountryData[] = [
  {
    name: 'Pakistan',
    code: 'PK',
    states: [
      {
        name: 'Punjab',
        cities: [
          'Faisalabad',
          'Lahore',
          'Rawalpindi',
          'Multan',
          'Gujranwala',
          'Sialkot',
          'Bahawalpur',
          'Sargodha',
          'Gujrat',
          'Sheikhupura',
          'Jhelum',
          'Sahiwal',
          'Kasur',
          'Rahim Yar Khan',
          'Okara',
          'Chiniot',
          'Samundri',
          'Kamoke',
          'Hafizabad',
          'Mandi Bahauddin',
          'Dera Ghazi Khan',
          'Mianwali',
          'Attock',
          'Vehari',
          'Khanewal',
          'Chakwal',
          'Jhang',
          'Muzaffargarh',
          'Bahawalnagar',
          'Murree',
          'Pakpattan',
          'Toba Tek Singh',
          'Layyah',
          'Lodhran',
          'Bhakkar',
          'Rajanpur',
          'Burewala',
          'Wazirabad',
          'Gojra',
          'Taxila',
          'Pattoki',
        ],
      },
      {
        name: 'Sindh',
        cities: [
          'Karachi',
          'Hyderabad',
          'Sukkur',
          'Larkana',
          'Nawabshah (Shaheed Benazirabad)',
          'Mirpur Khas',
          'Jacobabad',
          'Shikarpur',
          'Khairpur',
          'Thatta',
          'Badin',
          'Dadu',
          'Tando Adam',
          'Tando Allahyar',
          'Ghotki',
          'Kashmore',
          'Umerkot',
          'Sanghar',
          'Kotri',
          'Daharki',
          'Sehwan',
        ],
      },
      {
        name: 'Khyber Pakhtunkhwa (KPK)',
        cities: [
          'Peshawar',
          'Mardan',
          'Abbottabad',
          'Mingora (Swat)',
          'Kohat',
          'Dera Ismail Khan',
          'Nowshera',
          'Haripur',
          'Swabi',
          'Charsadda',
          'Mansehra',
          'Bannu',
          'Timergara',
          'Batkhela',
          'Hangu',
          'Karak',
          'Tank',
          'Chitral',
        ],
      },
      {
        name: 'Balochistan',
        cities: [
          'Quetta',
          'Gwadar',
          'Turbat',
          'Khuzdar',
          'Hub',
          'Chaman',
          'Sibi',
          'Zhob',
          'Loralai',
          'Dera Murad Jamali',
          'Mastung',
          'Kalat',
          'Ziarat',
          'Pishin',
        ],
      },
      {
        name: 'Islamabad Capital Territory',
        cities: ['Islamabad'],
      },
      {
        name: 'Azad Jammu & Kashmir (AJK)',
        cities: [
          'Muzaffarabad',
          'Mirpur',
          'Rawalakot',
          'Kotli',
          'Bhimber',
          'Bagh',
          'Pallandri',
        ],
      },
      {
        name: 'Gilgit-Baltistan',
        cities: ['Gilgit', 'Skardu', 'Hunza', 'Chilas', 'Astore'],
      },
    ],
  },
  {
    name: 'United States',
    code: 'US',
    states: [
      {
        name: 'California',
        cities: [
          'Los Angeles',
          'San Francisco',
          'San Diego',
          'San Jose',
          'Sacramento',
          'Fresno',
          'Long Beach',
          'Oakland',
          'Anaheim',
          'Irvine',
          'Santa Ana',
          'Riverside',
          'Fremont',
          'Bakersfield',
          'Palo Alto',
          'Sunnyvale',
        ],
      },
      {
        name: 'New York',
        cities: [
          'New York City',
          'Buffalo',
          'Rochester',
          'Yonkers',
          'Syracuse',
          'Albany',
          'White Plains',
          'New Rochelle',
        ],
      },
      {
        name: 'Texas',
        cities: [
          'Houston',
          'San Antonio',
          'Dallas',
          'Austin',
          'Fort Worth',
          'El Paso',
          'Arlington',
          'Plano',
          'Frisco',
          'Irving',
        ],
      },
      {
        name: 'Florida',
        cities: [
          'Miami',
          'Orlando',
          'Tampa',
          'Jacksonville',
          'Fort Lauderdale',
          'St. Petersburg',
          'Hialeah',
          'Tallahassee',
        ],
      },
      {
        name: 'Illinois',
        cities: ['Chicago', 'Aurora', 'Naperville', 'Joliet', 'Rockford', 'Springfield'],
      },
      {
        name: 'Washington',
        cities: ['Seattle', 'Spokane', 'Tacoma', 'Vancouver', 'Bellevue', 'Everett', 'Redmond'],
      },
      {
        name: 'Georgia',
        cities: ['Atlanta', 'Augusta', 'Columbus', 'Savannah', 'Athens', 'Sandy Springs'],
      },
      {
        name: 'Massachusetts',
        cities: ['Boston', 'Worcester', 'Cambridge', 'Lowell', 'Springfield', 'Quincy'],
      },
      {
        name: 'North Carolina',
        cities: ['Charlotte', 'Raleigh', 'Greensboro', 'Durham', 'Winston-Salem', 'Cary'],
      },
      {
        name: 'Pennsylvania',
        cities: ['Philadelphia', 'Pittsburgh', 'Allentown', 'Erie', 'Reading', 'Scranton'],
      },
      {
        name: 'Ohio',
        cities: ['Columbus', 'Cleveland', 'Cincinnati', 'Toledo', 'Akron', 'Dayton'],
      },
      {
        name: 'Colorado',
        cities: ['Denver', 'Colorado Springs', 'Aurora', 'Fort Collins', 'Boulder', 'Lakewood'],
      },
      {
        name: 'Michigan',
        cities: ['Detroit', 'Grand Rapids', 'Warren', 'Sterling Heights', 'Ann Arbor', 'Lansing'],
      },
      {
        name: 'New Jersey',
        cities: ['Newark', 'Jersey City', 'Paterson', 'Elizabeth', 'Edison', 'Trenton'],
      },
      {
        name: 'Arizona',
        cities: ['Phoenix', 'Tucson', 'Mesa', 'Chandler', 'Scottsdale', 'Tempe'],
      },
      {
        name: 'Virginia',
        cities: ['Virginia Beach', 'Norfolk', 'Chesapeake', 'Richmond', 'Alexandria', 'Arlington'],
      },
    ],
  },
  {
    name: 'United Arab Emirates',
    code: 'AE',
    states: [
      {
        name: 'Dubai',
        cities: [
          'Dubai (Downtown)',
          'Deira',
          'Bur Dubai',
          'Business Bay',
          'Jumeirah',
          'Dubai Marina',
          'Al Barsha',
          'Jumeirah Lake Towers (JLT)',
          'Dubai Silicon Oasis',
          'Al Quoz',
        ],
      },
      {
        name: 'Abu Dhabi',
        cities: ['Abu Dhabi City', 'Al Ain', 'Al Dhafra', 'Mussafah', 'Khalifa City', 'Yas Island'],
      },
      {
        name: 'Sharjah',
        cities: ['Sharjah City', 'Khor Fakkan', 'Kalba', 'Al Dhaid'],
      },
      {
        name: 'Ajman',
        cities: ['Ajman City', 'Masfout', 'Al Manama'],
      },
      {
        name: 'Ras Al Khaimah',
        cities: ['Ras Al Khaimah City', 'Al Jazirah Al Hamra', 'Al Rams'],
      },
      {
        name: 'Fujairah',
        cities: ['Fujairah City', 'Dibba Al-Fujairah'],
      },
      {
        name: 'Umm Al Quwain',
        cities: ['Umm Al Quwain City', 'Falaj Al Mualla'],
      },
    ],
  },
  {
    name: 'United Kingdom',
    code: 'GB',
    states: [
      {
        name: 'Greater London',
        cities: ['London', 'Westminster', 'Camden', 'Greenwich', 'Kensington', 'Islington', 'Hackney'],
      },
      {
        name: 'West Midlands',
        cities: ['Birmingham', 'Coventry', 'Wolverhampton', 'Solihull', 'Dudley', 'Walsall'],
      },
      {
        name: 'Greater Manchester',
        cities: ['Manchester', 'Salford', 'Bolton', 'Stockport', 'Oldham', 'Rochdale', 'Wigan'],
      },
      {
        name: 'West Yorkshire',
        cities: ['Leeds', 'Bradford', 'Wakefield', 'Huddersfield', 'Halifax'],
      },
      {
        name: 'North West (Merseyside)',
        cities: ['Liverpool', 'Chester', 'Preston', 'Blackpool', 'Blackburn', 'Birkenhead'],
      },
      {
        name: 'South West',
        cities: ['Bristol', 'Plymouth', 'Bournemouth', 'Swindon', 'Exeter', 'Bath', 'Gloucester'],
      },
      {
        name: 'East Midlands',
        cities: ['Leicester', 'Nottingham', 'Derby', 'Northampton', 'Lincoln'],
      },
      {
        name: 'Scotland',
        cities: ['Glasgow', 'Edinburgh', 'Aberdeen', 'Dundee', 'Inverness', 'Stirling', 'Perth'],
      },
      {
        name: 'Wales',
        cities: ['Cardiff', 'Swansea', 'Newport', 'Wrexham', 'Barry'],
      },
      {
        name: 'Northern Ireland',
        cities: ['Belfast', 'Derry / Londonderry', 'Lisburn', 'Newtownabbey', 'Bangor'],
      },
    ],
  },
  {
    name: 'Saudi Arabia',
    code: 'SA',
    states: [
      {
        name: 'Riyadh Province',
        cities: ['Riyadh', 'Al Kharj', 'Ad Diriyah', 'Al Majmaah', 'Ad Dawadimi'],
      },
      {
        name: 'Makkah Province',
        cities: ['Jeddah', 'Mecca (Makkah)', 'Taif', 'Rabigh', 'Al Qunfudhah'],
      },
      {
        name: 'Eastern Province',
        cities: ['Dammam', 'Khobar', 'Dhahran', 'Jubail', 'Al Ahsa (Hofuf)', 'Qatif', 'Hafar Al Batin'],
      },
      {
        name: 'Madinah Province',
        cities: ['Medina (Madinah)', 'Yanbu', 'Badr', 'Al Ula'],
      },
      {
        name: 'Asir Province',
        cities: ['Abha', 'Khamis Mushait', 'Bisha'],
      },
      {
        name: 'Tabuk Province',
        cities: ['Tabuk', 'Duba', 'Haql'],
      },
      {
        name: 'Al-Qassim Province',
        cities: ['Buraidah', 'Unaizah', 'Ar Rass'],
      },
    ],
  },
  {
    name: 'Canada',
    code: 'CA',
    states: [
      {
        name: 'Ontario',
        cities: ['Toronto', 'Ottawa', 'Mississauga', 'Brampton', 'Hamilton', 'London', 'Markham', 'Vaughan', 'Kitchener', 'Windsor'],
      },
      {
        name: 'Quebec',
        cities: ['Montreal', 'Quebec City', 'Laval', 'Gatineau', 'Longueuil', 'Sherbrooke'],
      },
      {
        name: 'British Columbia',
        cities: ['Vancouver', 'Surrey', 'Burnaby', 'Richmond', 'Abbotsford', 'Coquitlam', 'Kelowna', 'Victoria'],
      },
      {
        name: 'Alberta',
        cities: ['Calgary', 'Edmonton', 'Red Deer', 'Lethbridge', 'St. Albert', 'Medicine Hat'],
      },
      {
        name: 'Manitoba',
        cities: ['Winnipeg', 'Brandon', 'Steinbach'],
      },
      {
        name: 'Nova Scotia',
        cities: ['Halifax', 'Sydney', 'Dartmouth'],
      },
    ],
  },
  {
    name: 'Australia',
    code: 'AU',
    states: [
      {
        name: 'New South Wales',
        cities: ['Sydney', 'Newcastle', 'Central Coast', 'Wollongong', 'Maitland', 'Tweed Heads'],
      },
      {
        name: 'Victoria',
        cities: ['Melbourne', 'Geelong', 'Ballarat', 'Bendigo', 'Shepparton', 'Melton'],
      },
      {
        name: 'Queensland',
        cities: ['Brisbane', 'Gold Coast', 'Sunshine Coast', 'Townsville', 'Cairns', 'Toowoomba'],
      },
      {
        name: 'Western Australia',
        cities: ['Perth', 'Mandurah', 'Bunbury', 'Busselton', 'Geraldton'],
      },
      {
        name: 'South Australia',
        cities: ['Adelaide', 'Mount Gambier', 'Whyalla', 'Murray Bridge'],
      },
    ],
  },
  {
    name: 'Germany',
    code: 'DE',
    states: [
      {
        name: 'Bavaria',
        cities: ['Munich', 'Nuremberg', 'Augsburg', 'Würzburg', 'Regensburg', 'Ingolstadt'],
      },
      {
        name: 'North Rhine-Westphalia',
        cities: ['Cologne', 'Düsseldorf', 'Dortmund', 'Essen', 'Duisburg', 'Bochum', 'Wuppertal', 'Bonn'],
      },
      {
        name: 'Baden-Württemberg',
        cities: ['Stuttgart', 'Mannheim', 'Karlsruhe', 'Freiburg', 'Heidelberg', 'Ulm'],
      },
      {
        name: 'Berlin',
        cities: ['Berlin'],
      },
      {
        name: 'Hesse',
        cities: ['Frankfurt am Main', 'Wiesbaden', 'Kassel', 'Darmstadt', 'Offenbach'],
      },
      {
        name: 'Hamburg',
        cities: ['Hamburg'],
      },
      {
        name: 'Saxony',
        cities: ['Leipzig', 'Dresden', 'Chemnitz'],
      },
    ],
  },
  {
    name: 'Qatar',
    code: 'QA',
    states: [
      {
        name: 'Doha Municipality',
        cities: ['Doha', 'West Bay', 'The Pearl', 'Lusail', 'Al Sadd'],
      },
      {
        name: 'Al Rayyan',
        cities: ['Al Rayyan', 'Education City', 'Muaither'],
      },
      {
        name: 'Al Wakrah',
        cities: ['Al Wakrah', 'Mesaieed'],
      },
      {
        name: 'Al Khor',
        cities: ['Al Khor', 'Ras Laffan'],
      },
    ],
  },
  {
    name: 'India',
    code: 'IN',
    states: [
      {
        name: 'Maharashtra',
        cities: ['Mumbai', 'Pune', 'Nagpur', 'Thane', 'Nashik', 'Aurangabad', 'Navi Mumbai'],
      },
      {
        name: 'Karnataka',
        cities: ['Bengaluru (Bangalore)', 'Mysuru (Mysore)', 'Hubballi', 'Mangaluru', 'Belagavi'],
      },
      {
        name: 'Delhi NCR',
        cities: ['New Delhi', 'Delhi', 'Noida', 'Gurugram (Gurgaon)', 'Faridabad', 'Ghaziabad'],
      },
      {
        name: 'Tamil Nadu',
        cities: ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem'],
      },
      {
        name: 'Telangana',
        cities: ['Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar'],
      },
      {
        name: 'Gujarat',
        cities: ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar', 'Gandhinagar'],
      },
    ],
  },
];

export const ALL_COUNTRY_NAMES = COUNTRIES_DATA.map((c) => c.name);

export function getStatesForCountry(countryName: string): StateData[] {
  const country = COUNTRIES_DATA.find(
    (c) => c.name.toLowerCase() === countryName.trim().toLowerCase()
  );
  return country ? country.states : [];
}

export function getCitiesForState(countryName: string, stateName: string): string[] {
  const states = getStatesForCountry(countryName);
  const state = states.find(
    (s) => s.name.toLowerCase() === stateName.trim().toLowerCase()
  );
  return state ? state.cities : [];
}
