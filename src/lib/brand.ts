/** Shared brand assets and color tokens for marketing surfaces. */
export const BRAND_ASSETS = {
  heroImage: '/images/road-rescue-2.jpg',
  roadRescue: '/images/road-rescue.jpg',
  accraRoadNight: '/images/accra-road-night.jpg',
  logoLight: '/images/road-rescue-logo-item/RoadRescue_Primary_WhiteBackground.png',
  logoDark: '/images/road-rescue-logo-item/RoadRescue_Primary_Transparent.png',
  icon: '/images/road-rescue-logo-item/RoadRescue_Icon_WhiteBackground.png',
  brandOverview: '/images/road-rescue-logo-item/RoadRescue_Brand_Overview.png',
  iconTransparent: '/images/road-rescue-logo-item/RoadRescue_Icon_Transparent.png',
} as const;

/** Service card photos on the marketing site. */
export const SERVICE_IMAGES = {
  towing: { src: '/images/towing.jpg', position: 'center' },
  flatTyre: { src: '/images/flat-tyre.jpg', position: 'center' },
  battery: { src: '/images/battery.jpg', position: 'center' },
  lockout: { src: '/images/lockout.jpg', position: 'center' },
  fuelDelivery: { src: '/images/fuel-delivery.jpg', position: 'center' },
  accidentSupport: { src: '/images/accident-support.jpg', position: 'center' },
} as const;

/** Marketing photo crops — hero and section backgrounds. */
export const MARKETING_IMAGES = {
  hero: { src: BRAND_ASSETS.heroImage, position: '70% center' },
  onTheGround: { src: BRAND_ASSETS.roadRescue, position: 'center' },
  accraRoadNight: { src: BRAND_ASSETS.accraRoadNight, position: 'center' },
  roadside: { src: BRAND_ASSETS.roadRescue, position: '40% center' },
  mechanic: { src: BRAND_ASSETS.heroImage, position: '85% 25%' },
  wide: { src: BRAND_ASSETS.roadRescue, position: 'center' },
} as const;

export const BRAND = {
  blue: '#0E2C4A',
  blueLight: '#1A4A75',
  black: '#0A0A0A',
  navy: '#0B1F33',
  red: '#C41E3A',
} as const;
