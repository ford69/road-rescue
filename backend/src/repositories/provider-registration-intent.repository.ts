import { ProviderRegistrationIntent } from '../models/ProviderRegistrationIntent.js';

export const providerRegistrationIntentRepository = {
  create(data: Parameters<typeof ProviderRegistrationIntent.create>[0]) {
    return ProviderRegistrationIntent.create(data);
  },

  findByReference(reference: string) {
    return ProviderRegistrationIntent.findOne({ paystackReference: reference });
  },

  findOpenByEmail(email: string) {
    return ProviderRegistrationIntent.findOne({
      email: email.toLowerCase(),
      status: { $in: ['pending_payment', 'completing'] },
    }).sort({ createdAt: -1 });
  },
};
