import { connectDatabase, disconnectDatabase } from '../database/connection.js';
import { hashPassword } from '../auth/tokens.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { seedSubscriptionPlans } from '../services/subscription.service.js';
import {
  Customer,
  ChatMessage,
  Mechanic,
  Notification,
  Payment,
  RescueRequest,
  ServiceType,
  User,
  Vehicle,
} from '../models/index.js';

const serviceTypes = [
  {
    slug: 'flat-tire' as const,
    name: 'Flat Tyre',
    description: 'Tyre change or puncture repair at your location',
    estimatedPrice: 0,
    icon: 'CircleDot',
  },
  {
    slug: 'battery' as const,
    name: 'Battery Jump Start',
    description: 'Jump-start or battery replacement',
    estimatedPrice: 0,
    icon: 'BatteryCharging',
  },
  {
    slug: 'fuel' as const,
    name: 'Fuel Delivery',
    description: 'Emergency fuel delivery across Accra and beyond',
    estimatedPrice: 0,
    icon: 'Fuel',
  },
  {
    slug: 'towing' as const,
    name: 'Towing',
    description: 'Tow your vehicle to a trusted garage',
    estimatedPrice: 0,
    icon: 'Truck',
  },
  {
    slug: 'lockout' as const,
    name: 'Lockout',
    description: 'Keys locked inside the vehicle',
    estimatedPrice: 0,
    icon: 'KeyRound',
  },
  {
    slug: 'accident' as const,
    name: 'Accident Assist',
    description: 'Post-accident recovery and roadside support',
    estimatedPrice: 0,
    icon: 'AlertTriangle',
  },
  {
    slug: 'other' as const,
    name: 'Engine Diagnostics',
    description: 'On-site diagnostics for unexpected breakdowns',
    estimatedPrice: 0,
    icon: 'Wrench',
  },
];

async function seed(): Promise<void> {
  await connectDatabase();
  await seedSubscriptionPlans();

  await Promise.all([
    User.deleteMany({}),
    Customer.deleteMany({}),
    ChatMessage.deleteMany({}),
    Mechanic.deleteMany({}),
    Vehicle.deleteMany({}),
    ServiceType.deleteMany({}),
    RescueRequest.deleteMany({}),
    Notification.deleteMany({}),
    Payment.deleteMany({}),
  ]);

  await ServiceType.insertMany(serviceTypes);

  const adminPassword = await hashPassword(env.SEED_ADMIN_PASSWORD);
  const password = await hashPassword('Password123!');

  const admin = await User.create({
    firstName: 'Nana',
    lastName: 'Adjei',
    email: env.SEED_ADMIN_EMAIL,
    phone: env.SEED_ADMIN_PHONE,
    password: adminPassword,
    role: 'admin',
    status: 'active',
    emailVerified: true,
    emailVerifiedAt: new Date(),
  });

  const customerUsers = await User.insertMany([
    {
      firstName: 'Ama',
      lastName: 'Serwaa',
      email: 'ama.serwaa@example.com',
      phone: '+233241234567',
      password,
      role: 'customer',
      status: 'active',
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
    {
      firstName: 'Efua',
      lastName: 'Mensima',
      email: 'efua.mensima@example.com',
      phone: '+233201234567',
      password,
      role: 'customer',
      status: 'active',
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
    {
      firstName: 'Daniel',
      lastName: 'Ofori',
      email: 'daniel.ofori@example.com',
      phone: '+233551234567',
      password,
      role: 'customer',
      status: 'active',
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  ]);

  const mechanicUsers = await User.insertMany([
    {
      firstName: 'Kwame',
      lastName: 'Mensah',
      email: 'kwame.mensah@example.com',
      phone: '+233244111222',
      password,
      role: 'mechanic',
      status: 'active',
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
    {
      firstName: 'Kojo',
      lastName: 'Asare',
      email: 'kojo.asare@example.com',
      phone: '+233271112233',
      password,
      role: 'mechanic',
      status: 'active',
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
    {
      firstName: 'Richmond',
      lastName: 'Annor',
      email: 'richmond.annor@example.com',
      phone: '+233501112233',
      password,
      role: 'mechanic',
      status: 'active',
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
    {
      firstName: 'Michael',
      lastName: 'Tetteh',
      email: 'michael.tetteh@example.com',
      phone: '+233541112233',
      password,
      role: 'mechanic',
      status: 'active',
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
    {
      firstName: 'Yaw',
      lastName: 'Owusu',
      email: 'yaw.owusu@example.com',
      phone: '+233261112233',
      password,
      role: 'mechanic',
      status: 'active',
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
    {
      firstName: 'Nana',
      lastName: 'Boateng',
      email: 'nana.boateng@example.com',
      phone: '+233591112233',
      password,
      role: 'mechanic',
      status: 'active',
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  ]);

  const customers = await Customer.insertMany(
    customerUsers.map((user) => ({
      userId: user._id,
      emergencyContacts: [],
    })),
  );

  await Mechanic.insertMany([
    {
      userId: mechanicUsers[0]._id,
      garageName: 'Kwame Mobile Garage',
      experience: 8,
      location: { city: 'Accra', address: 'Spintex Road, near Jazz Plaza' },
      latitude: 5.635,
      longitude: -0.072,
      specialties: ['towing', 'battery', 'flat-tire'],
      availability: true,
      rating: 0,
      reviewCount: 0,
      completedJobs: 847,
      earnings: 48500,
      verificationStatus: 'verified',
      truck: 'Toyota Hilux Recovery',
      documents: [],
    },
    {
      userId: mechanicUsers[1]._id,
      garageName: 'Asare Roadside Assist',
      experience: 6,
      location: { city: 'Tema', address: 'Community 1, near Harbour' },
      latitude: 5.6698,
      longitude: -0.0166,
      specialties: ['lockout', 'fuel', 'battery'],
      availability: true,
      rating: 0,
      reviewCount: 0,
      completedJobs: 623,
      earnings: 36200,
      verificationStatus: 'verified',
      truck: 'Nissan Navara Service',
      documents: [],
    },
    {
      userId: mechanicUsers[2]._id,
      garageName: 'Annor Heavy Tow',
      experience: 10,
      location: { city: 'Accra', address: 'Ring Road Central' },
      latitude: 5.59,
      longitude: -0.2,
      specialties: ['towing', 'accident'],
      availability: true,
      rating: 0,
      reviewCount: 0,
      completedJobs: 501,
      earnings: 52100,
      verificationStatus: 'verified',
      truck: 'Isuzu Heavy Tow',
      documents: [],
    },
    {
      userId: mechanicUsers[3]._id,
      garageName: 'Tetteh Quick Fix',
      experience: 5,
      location: { city: 'Kasoa', address: 'Kasoa Highway' },
      latitude: 5.534,
      longitude: -0.418,
      specialties: ['flat-tire', 'fuel', 'lockout'],
      availability: false,
      rating: 0,
      reviewCount: 0,
      completedJobs: 398,
      earnings: 24800,
      verificationStatus: 'verified',
      truck: 'Hyundai Service Van',
      documents: [],
    },
    {
      userId: mechanicUsers[4]._id,
      garageName: 'Owusu East Legon Motors',
      experience: 7,
      location: { city: 'Accra', address: 'East Legon, Liberation Road' },
      latitude: 5.64,
      longitude: -0.15,
      specialties: ['battery', 'other', 'flat-tire'],
      availability: true,
      rating: 0,
      reviewCount: 0,
      completedJobs: 455,
      earnings: 31200,
      verificationStatus: 'verified',
      truck: 'Ford Ranger Assist',
      documents: [],
    },
    {
      userId: mechanicUsers[5]._id,
      garageName: 'Boateng Kumasi Rescue',
      experience: 9,
      location: { city: 'Kumasi', address: 'Ahodwo Roundabout' },
      latitude: 6.6666,
      longitude: -1.6163,
      specialties: ['towing', 'fuel', 'accident'],
      availability: true,
      rating: 0,
      reviewCount: 0,
      completedJobs: 412,
      earnings: 29800,
      verificationStatus: 'verified',
      truck: 'Mitsubishi L200 Tow',
      documents: [],
    },
  ]);

  await Vehicle.insertMany([
    {
      customerId: customers[0]._id,
      make: 'Toyota',
      vehicleModel: 'Corolla',
      colour: 'Silver',
      registrationNumber: 'GR-2345-21',
      year: 2021,
      engineType: 'petrol',
      nickname: 'Daily Runner',
    },
    {
      customerId: customers[0]._id,
      make: 'Hyundai',
      vehicleModel: 'Tucson',
      colour: 'Black',
      registrationNumber: 'GW-8891-20',
      year: 2020,
      engineType: 'petrol',
      nickname: 'Family SUV',
    },
    {
      customerId: customers[1]._id,
      make: 'Honda',
      vehicleModel: 'CR-V',
      colour: 'White',
      registrationNumber: 'AS-4412-22',
      year: 2022,
      engineType: 'petrol',
      nickname: 'Office Car',
    },
  ]);

  logger.info('Seed complete', {
    admin: admin.email,
    customers: customerUsers.length,
    mechanics: mechanicUsers.length,
  });

  await disconnectDatabase();
}

seed().catch(async (error) => {
  logger.error('Seed failed', { error });
  await disconnectDatabase();
  process.exit(1);
});
