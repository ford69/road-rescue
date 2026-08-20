export interface GhanaLocation {
  id: string;
  label: string;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
}

export const GHANA_PICKUP_LOCATIONS: GhanaLocation[] = [
  {
    id: 'spintex',
    label: 'Spintex Road',
    address: 'Spintex Road near Fiesta Royale',
    city: 'Accra',
    latitude: 5.6355,
    longitude: -0.074,
  },
  {
    id: 'ring-road',
    label: 'Ring Road Central',
    address: 'Ring Road Central near Circle',
    city: 'Accra',
    latitude: 5.59,
    longitude: -0.2,
  },
  {
    id: 'east-legon',
    label: 'East Legon',
    address: 'East Legon, Liberation Road',
    city: 'Accra',
    latitude: 5.64,
    longitude: -0.15,
  },
  {
    id: 'airport',
    label: 'Airport Residential',
    address: 'Airport Residential Area',
    city: 'Accra',
    latitude: 5.605,
    longitude: -0.17,
  },
  {
    id: 'madina',
    label: 'Madina Road',
    address: 'Madina Road near 37 Military Hospital junction approach',
    city: 'Accra',
    latitude: 5.668,
    longitude: -0.167,
  },
  {
    id: 'kasoa',
    label: 'Kasoa Highway',
    address: 'Kasoa Highway',
    city: 'Kasoa',
    latitude: 5.534,
    longitude: -0.418,
  },
  {
    id: 'tema',
    label: 'Tema Community 1',
    address: 'Community 1 near Harbour',
    city: 'Tema',
    latitude: 5.6698,
    longitude: -0.0166,
  },
  {
    id: 'kumasi',
    label: 'Kumasi Ahodwo',
    address: 'Ahodwo Roundabout',
    city: 'Kumasi',
    latitude: 6.6666,
    longitude: -1.6163,
  },
];

export const DEFAULT_PICKUP_LOCATION = GHANA_PICKUP_LOCATIONS[0];
