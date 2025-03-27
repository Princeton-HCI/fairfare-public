export interface ArgyleWebhookBase {
  name: string;
}

export interface WebhookIdentitiesAdded extends ArgyleWebhookBase {
  event: 'identities.added';
  data: {
    account: string;
    user: string;
    identity: string;
  };
}
export interface WebhookIdentitiesUpdated extends ArgyleWebhookBase {
  event: 'identities.updated';
  data: {
    account: string;
    user: string;
    identity: string;
  };
}
export interface WebhookGigsPartiallySynced extends ArgyleWebhookBase {
  event: 'gigs.partially_synced';
  data: {
    account: string;
    user: string;
    available_from: string;
    available_to: string;
    available_count: number;
    days_synced: number;
  };
}
export interface WebhookGigsFullySynced extends ArgyleWebhookBase {
  event: 'gigs.fully_synced';
  data: {
    account: string;
    user: string;
    available_from: string;
    available_to: string;
    available_count: number;
  };
}
export interface WebhookGigsAdded extends ArgyleWebhookBase {
  event: 'gigs.added';
  data: {
    account: string;
    user: string;
    available_from: string;
    available_to: string;
    available_count: number;
    added_count: number;
    added_from: string;
    added_to: string;
  };
}

export interface WebhookGigsUpdated extends ArgyleWebhookBase {
  event: 'gigs.updated';
  data: {
    account: string;
    user: string;
    available_from: string;
    available_to: string;
    available_count: number;
    updated_count: number;
    updated_from: string;
    updated_to: string;
    updated_gigs: string[];
  };
}

export interface WebhookGigsRemoved extends ArgyleWebhookBase {
  event: 'gigs.removed';
  data: {
    account: string;
    user: string;
    available_from: string;
    available_to: string;
    available_count: number;
    removed_count: number;
    removed_from: string;
    removed_to: string;
    removed_gigs: string[];
  };
}

export interface WebhookRatingsAdded extends ArgyleWebhookBase {
  event: 'ratings.added';
  data: {
    account: string;
    user: string;
    rating: string;
  };
}
export interface WebhookRatingsUpdated extends ArgyleWebhookBase {
  event: 'ratings.updated';
  data: {
    account: string;
    user: string;
    rating: string;
  };
}

export interface WebhookVehiclesAdded extends ArgyleWebhookBase {
  event: 'vehicles.added';
  data: {
    account: string;
    user: string;
    vehicle: string;
  };
}
export interface WebhookVehiclesUpdated extends ArgyleWebhookBase {
  event: 'vehicles.updated';
  data: {
    account: string;
    user: string;
    vehicle: string;
  };
}
export interface WebhookVehiclesRemoved extends ArgyleWebhookBase {
  event: 'vehicles.removed';
  data: {
    account: string;
    user: string;
    vehicle: string;
  };
}

export interface WebhookUsersFullySynced extends ArgyleWebhookBase {
  event: 'users.fully_synced';
  name: string;
  data: {
    user: string;
    resource: {
      id: string;
      accounts_connected: string[];
      items_connected: string[];
      employers_connected: string[];
      external_metadata: Record<string, unknown>;
      external_id: string | null;
      created_at: string;
    };
  };
}

export interface WebhookAccountsConnected extends ArgyleWebhookBase {
  event: 'accounts.connected';
  name: string;
  data: {
    user: string;
    account: string;
  };
}

export interface WebhookAccountsUpdated extends ArgyleWebhookBase {
  event: 'accounts.updated';
  name: string;
  data: {
    user: string;
    account: string;
  };
}

// Union type to represent any possible webhook response
export type ArgyleWebhookResponse =
  | WebhookIdentitiesAdded
  | WebhookIdentitiesUpdated
  | WebhookGigsPartiallySynced
  | WebhookGigsFullySynced
  | WebhookGigsAdded
  | WebhookGigsUpdated
  | WebhookGigsRemoved
  | WebhookRatingsAdded
  | WebhookRatingsUpdated
  | WebhookVehiclesAdded
  | WebhookVehiclesUpdated
  | WebhookVehiclesRemoved
  | WebhookUsersFullySynced
  | WebhookAccountsConnected
  | WebhookAccountsUpdated;
