import profileIsSynced from './profileIsSynced';

type Profile = SupabaseRows['profiles'];

describe('src/lib/profileIsSynced.ts', () => {
  describe('with empty phone number', () => {
    it('should return false when phone is null', () => {
      const profile = {
        phone: null
      } as Profile;
      expect(profileIsSynced(profile)).toBe(false);
    });

    it('should return false when phone is empty string', () => {
      const profile = {
        phone: ''
      } as Profile;
      expect(profileIsSynced(profile)).toBe(false);
    });
  });

  describe('with default placeholder numbers for temporary accounts', () => {
    it('should return false when phone starts with XXX555', () => {
      const profile = {
        phone: '123555678'
      } as Profile;
      expect(profileIsSynced(profile)).toBe(false);
    });

    it('should return false when phone is exactly XXX555XXX', () => {
      const profile = {
        phone: '123555999'
      } as Profile;
      expect(profileIsSynced(profile)).toBe(false);
    });

    it('should return false when phone is exactly XXX555XXXXXXXXX', () => {
      const profile = {
        phone: '123555999888777'
      } as Profile;
      expect(profileIsSynced(profile)).toBe(false);
    });
  });

  describe('with a real phone number', () => {
    it('should return true with a US phone number that does not contain 555', () => {
      const profile = {
        phone: '13039992222'
      } as Profile;
      expect(profileIsSynced(profile)).toBe(true);
    });

    it('should return true also for other country codes', () => {
      const profile = {
        phone: '39222666333'
      } as Profile;
      expect(profileIsSynced(profile)).toBe(true);
    });
  });
});
