type Profile = SupabaseRows['profiles'];

const profileIsSynced = (profile: Profile | null): boolean => {
  if (!profile) return false;

  const phone = profile.phone;

  if (!phone) return false;

  // here we check if it has the default phone format, e.g., if
  // it starts with XXX555, then the profile has not been synced
  return !/^\d{3}555/.test(phone); // Return true if synced (doesn't start with XXX555)
};

export default profileIsSynced;
